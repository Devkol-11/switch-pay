import { Context, Next } from 'hono';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { AuthService } from '../../modules/auth/auth.service';
import { AuthConfig } from '../../modules/auth/auth.types';
import { ResponseHelper } from '../utils/response';
import { getClient } from '../../providers/db';

const db = getClient();
const config: AuthConfig = {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    accessTokenExpiry: parseInt(process.env.ACCESS_TOKEN_EXPIRY || '900'),
    refreshTokenExpiry: parseInt(process.env.REFRESH_TOKEN_EXPIRY || '604800'),
    sessionExpiry: parseInt(process.env.SESSION_EXPIRY || '604800'),
    pepper: process.env.PEPPER_SECRET || 'your-pepper-secret-change-in-production'
};
const authService = new AuthService(db, config);

/**
 * Authentication middleware for Hono
 * Validates JWT token and attaches merchant information to context
 */
export async function authenticate(c: Context, next: Next) {
    try {
        // Get authorization header
        const authHeader = c.req.header('Authorization');
        if (!authHeader) {
            throw new AppError({
                code: ErrorCode.AUTH_UNAUTHORIZED,
                message: 'Authorization header is required'
            });
        }

        // Extract token (Bearer <token>)
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            throw new AppError({
                code: ErrorCode.AUTH_TOKEN_INVALID,
                message: 'Invalid authorization header format. Use: Bearer <token>'
            });
        }

        const token = parts[1];

        // Verify token
        const payload = await authService.verifyToken(token);

        // Check token type
        if (payload.type !== 'access') {
            throw new AppError({
                code: ErrorCode.AUTH_TOKEN_INVALID,
                message: 'Invalid token type. Use access token'
            });
        }

        // Attach merchant info to context using type assertion
        (c as any).set('merchantId', payload.merchantId);
        (c as any).set('sessionId', payload.sessionId);

        // Optionally fetch merchant data for additional context
        const merchant = await db.merchant.findUnique({
            where: { id: payload.merchantId },
            include: {
                profile: true
            }
        });

        if (!merchant) {
            throw new AppError({
                code: ErrorCode.AUTH_UNAUTHORIZED,
                message: 'Merchant not found'
            });
        }

        (c as any).set('merchant', merchant);

        await next();
    } catch (error) {
        // Handle errors using the response helper
        if (error instanceof AppError) {
            return ResponseHelper.error(c, error);
        }

        return ResponseHelper.unauthorized(c, 'Authentication failed');
    }
}

/**
 * Get merchant ID from context
 */
export function getMerchantId(c: Context): string {
    return (c as any).get('merchantId') as string;
}

/**
 * Get merchant from context
 */
export function getMerchant(c: Context): any {
    return (c as any).get('merchant');
}

/**
 * Get session ID from context
 */
export function getSessionId(c: Context): string {
    return (c as any).get('sessionId') as string;
}
