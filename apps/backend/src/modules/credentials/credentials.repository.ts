import {
    PrismaClient,
    ProviderCredential,
    Provider,
    Mode,
    CredentialStatus,
    Prisma
} from '../../generated/prisma/client';
import { AppError } from '../../shared/errors/app-error';
import { ErrorCode } from '../../shared/errors/error-codes';
import { CredentialFilters } from './credentials.types';

export class CredentialRepository {
    constructor(private prisma: PrismaClient) {}

    /**
     * Find credentials by merchant ID
     */
    async findByMerchantId(
        merchantId: string,
        filters?: CredentialFilters
    ): Promise<ProviderCredential[]> {
        try {
            return await this.prisma.providerCredential.findMany({
                where: {
                    merchantId,
                    ...(filters?.provider && { provider: filters.provider }),
                    ...(filters?.mode && { mode: filters.mode }),
                    ...(filters?.status && { status: filters.status })
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            throw new AppError({
                code: ErrorCode.DB_QUERY_FAILED,
                message: 'Failed to find credentials by merchant',
                cause: error,
                metadata: { merchantId }
            });
        }
    }

    /**
     * Find credential by ID
     */
    async findById(id: string): Promise<ProviderCredential | null> {
        try {
            return await this.prisma.providerCredential.findUnique({
                where: { id }
            });
        } catch (error) {
            throw new AppError({
                code: ErrorCode.DB_QUERY_FAILED,
                message: 'Failed to find credential by ID',
                cause: error,
                metadata: { id }
            });
        }
    }

    /**
     * Find credential by merchant, provider, and mode
     */
    async findByMerchantProviderAndMode(
        merchantId: string,
        provider: Provider,
        mode: Mode
    ): Promise<ProviderCredential | null> {
        try {
            return await this.prisma.providerCredential.findUnique({
                where: {
                    merchantId_provider_mode: {
                        merchantId,
                        provider,
                        mode
                    }
                }
            });
        } catch (error) {
            throw new AppError({
                code: ErrorCode.DB_QUERY_FAILED,
                message: 'Failed to find credential',
                cause: error,
                metadata: { merchantId, provider, mode }
            });
        }
    }

    /**
     * Create a new credential
     */
    async create(
        data: {
            merchantId: string;
            provider: Provider;
            mode: Mode;
            encryptedSecret: Buffer;
            encryptionKeyId: string;
            publicKey?: string;
            status: CredentialStatus;
        },
        trx?: Prisma.TransactionClient
    ): Promise<ProviderCredential> {
        try {
            const db = trx ?? this.prisma;
            return await db.providerCredential.create({
                data: {
                    id: this.generateUlid(),
                    merchantId: data.merchantId,
                    provider: data.provider,
                    mode: data.mode,
                    encryptedSecret: data.encryptedSecret,
                    encryptionKeyId: data.encryptionKeyId,
                    publicKey: data.publicKey || null,
                    status: data.status
                }
            });
        } catch (error) {
            // Check for unique constraint violation
            if (error instanceof Error && error.message.includes('Unique constraint')) {
                throw new AppError({
                    code: ErrorCode.DB_UNIQUE_VIOLATION,
                    message: `Credential for ${data.provider} (${data.mode} mode) already exists`,
                    cause: error,
                    metadata: {
                        merchantId: data.merchantId,
                        provider: data.provider,
                        mode: data.mode
                    }
                });
            }

            // Check for foreign key constraint violation
            if (error instanceof Error && error.message.includes('Foreign key')) {
                throw new AppError({
                    code: ErrorCode.DB_FOREIGN_KEY_VIOLATION,
                    message: 'Merchant not found',
                    cause: error,
                    metadata: { merchantId: data.merchantId }
                });
            }

            throw new AppError({
                code: ErrorCode.DB_QUERY_FAILED,
                message: 'Failed to create credential',
                cause: error,
                metadata: { merchantId: data.merchantId, provider: data.provider }
            });
        }
    }

    /**
     * Update a credential
     */
    async update(
        id: string,
        data: {
            encryptedSecret?: Buffer;
            encryptionKeyId?: string;
            publicKey?: string | null;
            status?: CredentialStatus;
        },
        trx?: Prisma.TransactionClient
    ): Promise<ProviderCredential> {
        try {
            const db = trx ?? this.prisma;
            return await db.providerCredential.update({
                where: { id },
                data
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes('Record to update not found')) {
                throw new AppError({
                    code: ErrorCode.RES_NOT_FOUND,
                    message: 'Credential not found',
                    cause: error,
                    metadata: { id }
                });
            }

            throw new AppError({
                code: ErrorCode.DB_QUERY_FAILED,
                message: 'Failed to update credential',
                cause: error,
                metadata: { id }
            });
        }
    }

    /**
     * Delete a credential
     */
    async delete(id: string, trx?: Prisma.TransactionClient): Promise<ProviderCredential> {
        try {
            const db = trx ?? this.prisma;
            return await db.providerCredential.delete({
                where: { id }
            });
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes('Record to delete does not exist')
            ) {
                throw new AppError({
                    code: ErrorCode.RES_NOT_FOUND,
                    message: 'Credential not found',
                    cause: error,
                    metadata: { id }
                });
            }

            throw new AppError({
                code: ErrorCode.DB_QUERY_FAILED,
                message: 'Failed to delete credential',
                cause: error,
                metadata: { id }
            });
        }
    }

    /**
     * Count credentials by merchant
     */
    async countByMerchantId(merchantId: string): Promise<number> {
        try {
            return await this.prisma.providerCredential.count({
                where: { merchantId }
            });
        } catch (error) {
            throw new AppError({
                code: ErrorCode.DB_QUERY_FAILED,
                message: 'Failed to count credentials',
                cause: error,
                metadata: { merchantId }
            });
        }
    }

    /**
     * Check if credential exists
     */
    async exists(merchantId: string, provider: Provider, mode: Mode): Promise<boolean> {
        try {
            const count = await this.prisma.providerCredential.count({
                where: {
                    merchantId,
                    provider,
                    mode
                }
            });
            return count > 0;
        } catch (error) {
            throw new AppError({
                code: ErrorCode.DB_QUERY_FAILED,
                message: 'Failed to check credential existence',
                cause: error,
                metadata: { merchantId, provider, mode }
            });
        }
    }

    /**
     * Find active credentials by merchant and provider
     */
    async findActiveByMerchantAndProvider(
        merchantId: string,
        provider: Provider
    ): Promise<ProviderCredential[]> {
        try {
            return await this.prisma.providerCredential.findMany({
                where: {
                    merchantId,
                    provider,
                    status: CredentialStatus.active
                },
                orderBy: { mode: 'asc' }
            });
        } catch (error) {
            throw new AppError({
                code: ErrorCode.DB_QUERY_FAILED,
                message: 'Failed to find active credentials',
                cause: error,
                metadata: { merchantId, provider }
            });
        }
    }

    private generateUlid(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return timestamp + random;
    }
}
