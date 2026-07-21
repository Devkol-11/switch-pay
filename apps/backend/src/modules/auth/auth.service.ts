import { PrismaClient } from '../../generated/prisma/client';
import { MerchantUserRepo } from './repositories/merchant.user.repo';
import { MerchantAccountRepo } from './repositories/merchant.account.repo';
import { MerchantSessionRepo } from './repositories/merchant.session.repo';
import { MerchantProfileRepo } from './repositories/merchant.profile.repo';
import {
    AccountType,
    OAuthProvider,
    Merchant,
    MerchantAccount,
    MerchantSession
} from '../../generated/prisma/client';
import {
    RegisterData,
    LoginData,
    AuthConfig,
    AuthResponse,
    AuthTokens,
    TokenPayload,
    OAuthLoginData
} from './auth.types';
import { hash, verify } from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';
import { ulid } from 'ulid';
import { AppError, AppErrorFactory } from '../../shared/errors/app-error';
import { ErrorCode } from '../../shared/errors/error-codes';
import { dbTransaction, TransactionClient } from '../../shared/utils/db.transaction';

export class AuthService {
    private userRepo: MerchantUserRepo;
    private accountRepo: MerchantAccountRepo;
    private sessionRepo: MerchantSessionRepo;
    private profileRepo: MerchantProfileRepo;

    constructor(
        private prisma: PrismaClient,
        private config: AuthConfig
    ) {
        this.userRepo = new MerchantUserRepo(prisma);
        this.accountRepo = new MerchantAccountRepo(prisma);
        this.sessionRepo = new MerchantSessionRepo(prisma);
        this.profileRepo = new MerchantProfileRepo(prisma);
    }

    // ============== REGISTRATION ==============

    /**
     * Register a new merchant with email/password
     */
    async register(data: RegisterData): Promise<AuthResponse> {
        this.validateEmail(data.email);
        this.validatePassword(data.password);

        const existingMerchant = await this.userRepo.findByEmail(data.email);
        if (existingMerchant) {
            throw AppErrorFactory.auth(
                ErrorCode.AUTH_EMAIL_TAKEN,
                'Email address is already registered',
                { email: data.email }
            );
        }

        const hashedPassword = await hash(data.password + this.config.pepper);

        // Use dbTransaction utility
        return await dbTransaction(async (trx: TransactionClient) => {
            // Create merchant using transaction client
            const merchant = await this.userRepo.create({ email: data.email }, trx);

            // Create credential account using transaction client
            await this.accountRepo.createCredentialAccount(merchant.id, hashedPassword, trx);

            // Create profile using transaction client
            await this.profileRepo.create(
                merchant.id,
                data.businessName,
                data.defaultCurrency || 'NGN',
                undefined,
                undefined,
                trx
            );

            // Create session and tokens - PASS THE TRANSACTION CLIENT
            const { session, tokens } = await this.createSessionAndTokensWithTx(
                trx,
                merchant.id,
                data.userAgent || 'unknown',
                data.ipAddress || 'unknown'
            );

            // Fetch complete merchant data using transaction client
            const completeMerchant = (await trx.merchant.findUnique({
                where: { id: merchant.id },
                include: {
                    profile: true,
                    accounts: true
                }
            })) as Merchant;

            return {
                merchant: completeMerchant,
                tokens,
                session
            };
        });
    }

    // ============== LOGIN ==============

    /**
     * Login with email and password
     */
    async login(data: LoginData): Promise<AuthResponse> {
        const merchant = await this.userRepo.findByEmail(data.email);
        if (!merchant) {
            throw AppErrorFactory.auth(
                ErrorCode.AUTH_INVALID_CREDENTIALS,
                'Invalid email or password',
                { email: data.email }
            );
        }

        const account = await this.accountRepo.findCredentialAccount(merchant.id);
        if (!account || !account.passwordHash) {
            throw AppErrorFactory.auth(
                ErrorCode.AUTH_INVALID_CREDENTIALS,
                'Invalid email or password',
                { merchantId: merchant.id }
            );
        }

        const isValid = await verify(account.passwordHash, data.password + this.config.pepper);
        if (!isValid) {
            throw AppErrorFactory.auth(
                ErrorCode.AUTH_INVALID_CREDENTIALS,
                'Invalid email or password',
                { merchantId: merchant.id }
            );
        }

        const profile = await this.profileRepo.findByMerchantId(merchant.id);
        if (!profile) {
            throw new AppError({
                code: ErrorCode.RES_NOT_FOUND,
                message: 'Merchant profile not found',
                metadata: { merchantId: merchant.id }
            });
        }

        // Use dbTransaction for session creation
        return await dbTransaction(async (trx: TransactionClient) => {
            const { session, tokens } = await this.createSessionAndTokensWithTx(
                trx,
                merchant.id,
                data.userAgent || 'unknown',
                data.ipAddress || 'unknown'
            );

            const completeMerchant = (await trx.merchant.findUnique({
                where: { id: merchant.id },
                include: {
                    profile: true,
                    accounts: true
                }
            })) as Merchant;

            return {
                merchant: completeMerchant,
                tokens,
                session
            };
        });
    }

    // ============== OAUTH LOGIN ==============

    /**
     * Login or register with OAuth provider
     */
    async oauthLogin(data: OAuthLoginData): Promise<AuthResponse> {
        // Check if OAuth account exists
        let account = await this.accountRepo.findOAuthAccount(
            data.provider,
            data.providerAccountId
        );

        let merchant: Merchant | null = null;

        if (account) {
            // Existing OAuth account - login
            merchant = await this.userRepo.findById(account.merchantId);
            if (!merchant) {
                throw new AppError({
                    code: ErrorCode.RES_NOT_FOUND,
                    message: 'Merchant not found for OAuth account',
                    metadata: {
                        provider: data.provider,
                        providerAccountId: data.providerAccountId
                    }
                });
            }

            // Update OAuth tokens
            await this.accountRepo.updateOAuthTokens(
                merchant.id,
                data.provider,
                data.providerAccountId,
                data.accessToken,
                data.refreshToken,
                data.tokenExpiresAt
            );
        } else {
            // Check if merchant exists with this email
            const existingMerchant = await this.userRepo.findByEmail(data.email);

            if (existingMerchant) {
                // Link OAuth to existing merchant
                account = await this.accountRepo.linkOAuthAccount(
                    existingMerchant.id,
                    data.provider,
                    data.providerAccountId,
                    data.accessToken
                );
                merchant = existingMerchant;
            } else {
                // Create new merchant with OAuth using dbTransaction
                merchant = await dbTransaction(async (trx: TransactionClient) => {
                    // Create merchant using transaction client
                    const newMerchant = await this.userRepo.create({ email: data.email }, trx);

                    // Create OAuth account using transaction client
                    await this.accountRepo.createOAuthAccount(
                        newMerchant.id,
                        data.provider,
                        data.providerAccountId,
                        data.accessToken,
                        data.refreshToken,
                        data.tokenExpiresAt,
                        trx
                    );

                    // Create profile using transaction client
                    await this.profileRepo.create(
                        newMerchant.id,
                        data.businessName,
                        'NGN',
                        undefined,
                        undefined,
                        trx
                    );

                    return newMerchant;
                });
            }
        }

        // Create session and tokens using dbTransaction
        return await dbTransaction(async (trx: TransactionClient) => {
            const { session, tokens } = await this.createSessionAndTokensWithTx(
                trx,
                merchant.id,
                'oauth',
                'oauth'
            );

            const completeMerchant = (await trx.merchant.findUnique({
                where: { id: merchant.id },
                include: {
                    profile: true,
                    accounts: true
                }
            })) as Merchant;

            return {
                merchant: completeMerchant,
                tokens,
                session
            };
        });
    }

    // ============== TOKEN MANAGEMENT ==============

    /**
     * Refresh access token using refresh token
     */
    async refreshTokens(refreshToken: string): Promise<AuthTokens> {
        // Verify refresh token
        const payload = await this.verifyToken(refreshToken);

        if (payload.type !== 'refresh') {
            throw new AppError({
                code: ErrorCode.AUTH_TOKEN_INVALID,
                message: 'Invalid token type',
                metadata: { type: payload.type }
            });
        }

        const merchantId = payload.merchantId;
        const sessionId = payload.sessionId;

        // Verify session exists and is valid
        const session = await this.prisma.merchantSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            throw new AppError({
                code: ErrorCode.AUTH_SESSION_INVALID,
                message: 'Session not found',
                metadata: { sessionId }
            });
        }

        if (session.expiresAt <= new Date()) {
            throw new AppError({
                code: ErrorCode.AUTH_SESSION_EXPIRED,
                message: 'Session has expired',
                metadata: { sessionId, expiredAt: session.expiresAt }
            });
        }

        // Generate new tokens
        const newTokens = await this.generateTokens(merchantId, sessionId);

        // Update session token
        await this.prisma.merchantSession.update({
            where: { id: sessionId },
            data: { sessionToken: newTokens.refreshToken }
        });

        return newTokens;
    }

    /**
     * Verify JWT token
     */
    async verifyToken(token: string): Promise<TokenPayload> {
        try {
            const { payload } = await jwtVerify(
                token,
                new TextEncoder().encode(this.config.jwtSecret)
            );
            return payload as TokenPayload;
        } catch (error) {
            // Handle specific JWT errors
            if (error instanceof Error) {
                if (error.message.includes('expired')) {
                    throw new AppError({
                        code: ErrorCode.AUTH_TOKEN_EXPIRED,
                        message: 'Authentication token has expired',
                        cause: error
                    });
                }
                if (error.message.includes('invalid')) {
                    throw new AppError({
                        code: ErrorCode.AUTH_TOKEN_INVALID,
                        message: 'Invalid authentication token',
                        cause: error
                    });
                }
            }

            throw new AppError({
                code: ErrorCode.AUTH_TOKEN_INVALID,
                message: 'Token verification failed',
                cause: error
            });
        }
    }

    // ============== SESSION MANAGEMENT ==============

    /**
     * Logout - invalidate specific session
     */
    async logout(sessionToken: string): Promise<void> {
        const session = await this.sessionRepo.findByToken(sessionToken);
        if (session) {
            await this.sessionRepo.invalidate(sessionToken);
        }
    }

    /**
     * Logout from all devices
     */
    async logoutAll(merchantId: string): Promise<{ count: number }> {
        return await this.sessionRepo.invalidateAll(merchantId);
    }

    /**
     * Get all active sessions
     */
    async getActiveSessions(merchantId: string): Promise<MerchantSession[]> {
        return await this.sessionRepo.findActiveSessions(merchantId);
    }

    /**
     * Rotate session - create new session and invalidate old
     */
    async rotateSession(
        oldSessionToken: string,
        userAgent?: string,
        ipAddress?: string
    ): Promise<AuthResponse> {
        // Find old session
        const oldSession = await this.sessionRepo.findByToken(oldSessionToken);
        if (!oldSession) {
            throw new AppError({
                code: ErrorCode.AUTH_SESSION_INVALID,
                message: 'Invalid session',
                metadata: { sessionToken: oldSessionToken.substring(0, 10) + '...' }
            });
        }

        // Invalidate old session
        await this.sessionRepo.invalidate(oldSessionToken);

        // Create new session and tokens using dbTransaction
        return await dbTransaction(async (trx: TransactionClient) => {
            const { session, tokens } = await this.createSessionAndTokensWithTx(
                trx,
                oldSession.merchantId,
                userAgent || oldSession.userAgent || 'unknown',
                ipAddress || oldSession.ipAddress || 'unknown'
            );

            // Fetch merchant
            const merchant = await this.userRepo.findById(oldSession.merchantId);
            if (!merchant) {
                throw new AppError({
                    code: ErrorCode.RES_NOT_FOUND,
                    message: 'Merchant not found',
                    metadata: { merchantId: oldSession.merchantId }
                });
            }

            const completeMerchant = (await trx.merchant.findUnique({
                where: { id: merchant.id },
                include: {
                    profile: true,
                    accounts: true
                }
            })) as Merchant;

            return {
                merchant: completeMerchant,
                tokens,
                session
            };
        });
    }

    // ============== PASSWORD MANAGEMENT ==============

    /**
     * Change password
     */
    async changePassword(
        merchantId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<void> {
        // Validate new password
        this.validatePassword(newPassword);

        // Get credential account
        const account = await this.accountRepo.findCredentialAccount(merchantId);
        if (!account || !account.passwordHash) {
            throw new AppError({
                code: ErrorCode.RES_NOT_FOUND,
                message: 'No credential account found',
                metadata: { merchantId }
            });
        }

        // Verify current password
        const isValid = await verify(account.passwordHash, currentPassword + this.config.pepper);
        if (!isValid) {
            throw AppErrorFactory.auth(
                ErrorCode.AUTH_INVALID_CREDENTIALS,
                'Current password is incorrect',
                { merchantId }
            );
        }

        // Hash new password
        const newHashedPassword = await hash(newPassword + this.config.pepper);

        // Use dbTransaction for atomic update and session invalidation
        await dbTransaction(async (trx: TransactionClient) => {
            // Update password using transaction client
            await this.accountRepo.updatePassword(merchantId, newHashedPassword, trx);

            // Invalidate all sessions for security using transaction client
            await this.sessionRepo.invalidateAll(merchantId, trx);
        });
    }

    /**
     * Reset password (forgot password flow)
     */
    async resetPassword(merchantId: string, newPassword: string): Promise<void> {
        // Validate new password
        this.validatePassword(newPassword);

        // Check if merchant exists
        const merchant = await this.userRepo.findById(merchantId);
        if (!merchant) {
            throw new AppError({
                code: ErrorCode.RES_NOT_FOUND,
                message: 'Merchant not found',
                metadata: { merchantId }
            });
        }

        // Hash new password
        const newHashedPassword = await hash(newPassword + this.config.pepper);

        // Use dbTransaction for atomic update and session invalidation
        await dbTransaction(async (trx: TransactionClient) => {
            // Update password using transaction client
            await this.accountRepo.updatePassword(merchantId, newHashedPassword, trx);

            // Invalidate all sessions for security using transaction client
            await this.sessionRepo.invalidateAll(merchantId, trx);
        });
    }

    /**
     * Check if merchant has password set
     */
    async hasPassword(merchantId: string): Promise<boolean> {
        return await this.accountRepo.hasCredentialAccount(merchantId);
    }

    // ============== ACCOUNT LINKING ==============

    /**
     * Link OAuth account to existing merchant
     */
    async linkOAuth(
        merchantId: string,
        provider: OAuthProvider,
        providerAccountId: string,
        accessToken: string,
        refreshToken?: string,
        tokenExpiresAt?: Date
    ): Promise<MerchantAccount> {
        // Check if merchant exists
        const merchant = await this.userRepo.findById(merchantId);
        if (!merchant) {
            throw new AppError({
                code: ErrorCode.RES_NOT_FOUND,
                message: 'Merchant not found',
                metadata: { merchantId }
            });
        }

        // Check if OAuth account already exists
        const existing = await this.accountRepo.findOAuthAccount(provider, providerAccountId);
        if (existing) {
            throw new AppError({
                code: ErrorCode.RES_ALREADY_EXISTS,
                message: 'OAuth account already linked to another merchant',
                metadata: {
                    provider,
                    providerAccountId,
                    existingMerchantId: existing.merchantId
                }
            });
        }

        // Link to merchant using dbTransaction
        return await dbTransaction(async (trx: TransactionClient) => {
            return await this.accountRepo.linkOAuthAccount(
                merchantId,
                provider,
                providerAccountId,
                accessToken,
                trx
            );
        });
    }

    /**
     * Unlink OAuth account
     */
    async unlinkOAuth(merchantId: string, accountId: string): Promise<void> {
        const account = await this.prisma.merchantAccount.findUnique({
            where: { id: accountId }
        });

        if (!account || account.merchantId !== merchantId) {
            throw new AppError({
                code: ErrorCode.RES_NOT_FOUND,
                message: 'Account not found',
                metadata: { accountId, merchantId }
            });
        }

        if (account.type === AccountType.credentials) {
            throw new AppError({
                code: ErrorCode.BIZ_INVALID_OPERATION,
                message: 'Cannot unlink credential account',
                metadata: { accountId, type: account.type }
            });
        }

        // Check if this is the only account
        const accounts = await this.accountRepo.findByMerchantId(merchantId);
        if (accounts.length <= 1) {
            throw new AppError({
                code: ErrorCode.BIZ_INVALID_OPERATION,
                message: 'Cannot unlink the only authentication method',
                metadata: { merchantId, accountId }
            });
        }

        // Delete using dbTransaction
        await dbTransaction(async (trx: TransactionClient) => {
            await this.accountRepo.delete(accountId, trx);
        });
    }

    // ============== PRIVATE HELPERS ==============

    /**
     * Create session and generate tokens with transaction client
     */
    private async createSessionAndTokensWithTx(
        trx: TransactionClient,
        merchantId: string,
        userAgent: string,
        ipAddress: string
    ): Promise<{ session: MerchantSession; tokens: AuthTokens }> {
        // Create session
        const sessionId = ulid();
        const sessionToken = this.generateSessionToken();
        const sessionExpiry = new Date(Date.now() + this.config.sessionExpiry * 1000);

        const session = await trx.merchantSession.create({
            data: {
                id: sessionId,
                merchantId,
                sessionToken,
                userAgent,
                ipAddress,
                expiresAt: sessionExpiry
            }
        });

        // Generate JWT tokens
        const tokens = await this.generateTokens(merchantId, sessionId);

        // Update session with refresh token
        const updatedSession = await trx.merchantSession.update({
            where: { id: sessionId },
            data: { sessionToken: tokens.refreshToken }
        });

        return {
            session: updatedSession,
            tokens
        };
    }

    /**
     * Generate JWT tokens
     */
    private async generateTokens(merchantId: string, sessionId: string): Promise<AuthTokens> {
        const secret = new TextEncoder().encode(this.config.jwtSecret);

        // Access token
        const accessToken = await new SignJWT({
            merchantId,
            sessionId,
            type: 'access'
        } as TokenPayload)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(`${this.config.accessTokenExpiry}s`)
            .sign(secret);

        // Refresh token
        const refreshToken = await new SignJWT({
            merchantId,
            sessionId,
            type: 'refresh'
        } as TokenPayload)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(`${this.config.refreshTokenExpiry}s`)
            .sign(secret);

        return {
            accessToken,
            refreshToken,
            expiresIn: this.config.accessTokenExpiry
        };
    }

    /**
     * Generate random session token
     */
    private generateSessionToken(): string {
        return randomBytes(32).toString('hex');
    }

    /**
     * Validate email format
     */
    private validateEmail(email: string): void {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw AppErrorFactory.auth(ErrorCode.VAL_INVALID_EMAIL, 'Invalid email format', {
                email
            });
        }
    }

    /**
     * Validate password strength
     */
    private validatePassword(password: string): void {
        const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            throw AppErrorFactory.auth(
                ErrorCode.AUTH_WEAK_PASSWORD,
                'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
                { passwordLength: password.length }
            );
        }
    }
}
