// src/repositories/merchant-account.repo.ts
import {
  PrismaClient,
  MerchantAccount,
  AccountType,
  OAuthProvider,
  Prisma,
} from "../../../generated/prisma/client";
import { AppError } from "../../../shared/errors/app-error";
import { ErrorCode } from "../../../shared/errors/error-codes";

export class MerchantAccountRepo {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find an account by merchant ID and type
   */
  async findByMerchantAndType(
    merchantId: string,
    type: AccountType
  ): Promise<MerchantAccount | null> {
    try {
      return await this.prisma.merchantAccount.findFirst({
        where: {
          merchantId,
          type,
        },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to find account by merchant and type",
        cause: error,
        metadata: { merchantId, type },
      });
    }
  }

  /**
   * Find a credential account by merchant ID
   */
  async findCredentialAccount(
    merchantId: string
  ): Promise<MerchantAccount | null> {
    try {
      return await this.prisma.merchantAccount.findFirst({
        where: {
          merchantId,
          type: AccountType.credentials,
        },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to find credential account",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Find an OAuth account by provider and provider account ID
   */
  async findOAuthAccount(
    provider: OAuthProvider,
    providerAccountId: string
  ): Promise<MerchantAccount | null> {
    try {
      return await this.prisma.merchantAccount.findFirst({
        where: {
          provider,
          providerAccountId,
        },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to find OAuth account",
        cause: error,
        metadata: { provider, providerAccountId },
      });
    }
  }

  /**
   * Find all accounts for a merchant
   */
  async findByMerchantId(merchantId: string): Promise<MerchantAccount[]> {
    try {
      return await this.prisma.merchantAccount.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to find accounts by merchant",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Create a credential account (email/password)
   */
  async createCredentialAccount(
    merchantId: string,
    passwordHash: string,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantAccount> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantAccount.create({
        data: {
          id: this.generateUlid(),
          merchantId,
          type: AccountType.credentials,
          passwordHash,
        },
      });
    } catch (error) {
      // Check for unique constraint violation
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        throw new AppError({
          code: ErrorCode.DB_UNIQUE_VIOLATION,
          message: "Credential account already exists for this merchant",
          cause: error,
          metadata: { merchantId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to create credential account",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Create an OAuth account
   */
  async createOAuthAccount(
    merchantId: string,
    provider: OAuthProvider,
    providerAccountId: string,
    accessToken: string,
    refreshToken?: string,
    tokenExpiresAt?: Date,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantAccount> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantAccount.create({
        data: {
          id: this.generateUlid(),
          merchantId,
          type: AccountType.oauth,
          provider,
          providerAccountId,
          accessToken,
          refreshToken,
          tokenExpiresAt,
        },
      });
    } catch (error) {
      // Check for unique constraint violation
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        throw new AppError({
          code: ErrorCode.DB_UNIQUE_VIOLATION,
          message: "OAuth account already exists for this provider",
          cause: error,
          metadata: { merchantId, provider, providerAccountId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to create OAuth account",
        cause: error,
        metadata: { merchantId, provider },
      });
    }
  }

  /**
   * Update password hash for credential account
   */
  async updatePassword(
    merchantId: string,
    passwordHash: string,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantAccount> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantAccount.update({
        where: {
          merchantId_type: {
            merchantId,
            type: AccountType.credentials,
          },
        },
        data: { passwordHash },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Record to update not found")) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Credential account not found",
          cause: error,
          metadata: { merchantId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to update password",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Update OAuth tokens
   */
  async updateOAuthTokens(
    merchantId: string,
    provider: OAuthProvider,
    providerAccountId: string,
    accessToken: string,
    refreshToken?: string,
    tokenExpiresAt?: Date,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantAccount> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantAccount.update({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        data: {
          accessToken,
          refreshToken,
          tokenExpiresAt,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Record to update not found")) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "OAuth account not found",
          cause: error,
          metadata: { provider, providerAccountId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to update OAuth tokens",
        cause: error,
        metadata: { merchantId, provider },
      });
    }
  }

  /**
   * Link OAuth account to existing merchant
   */
  async linkOAuthAccount(
    merchantId: string,
    provider: OAuthProvider,
    providerAccountId: string,
    accessToken: string,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantAccount> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantAccount.create({
        data: {
          id: this.generateUlid(),
          merchantId,
          type: AccountType.oauth,
          provider,
          providerAccountId,
          accessToken,
        },
      });
    } catch (error) {
      // Check for unique constraint violation
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        throw new AppError({
          code: ErrorCode.DB_UNIQUE_VIOLATION,
          message: "OAuth account already linked to another merchant",
          cause: error,
          metadata: { merchantId, provider, providerAccountId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to link OAuth account",
        cause: error,
        metadata: { merchantId, provider },
      });
    }
  }

  /**
   * Delete an account
   */
  async delete(
    id: string,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantAccount> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantAccount.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Record to delete does not exist")) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Account not found",
          cause: error,
          metadata: { id },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to delete account",
        cause: error,
        metadata: { id },
      });
    }
  }

  /**
   * Check if merchant has a credential account
   */
  async hasCredentialAccount(merchantId: string): Promise<boolean> {
    try {
      const count = await this.prisma.merchantAccount.count({
        where: {
          merchantId,
          type: AccountType.credentials,
        },
      });
      return count > 0;
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to check credential account existence",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  private generateUlid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return timestamp + random;
  }
}