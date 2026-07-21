// src/repositories/merchant-session.repo.ts
import {
  PrismaClient,
  MerchantSession,
  Prisma,
} from "../../../generated/prisma/client";
import { AppError } from "../../../shared/errors/app-error";
import { ErrorCode } from "../../../shared/errors/error-codes";

export class MerchantSessionRepo {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new session
   */
  async create(
    merchantId: string,
    sessionToken: string,
    expiresAt: Date,
    userAgent?: string,
    ipAddress?: string,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantSession> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantSession.create({
        data: {
          id: this.generateUlid(),
          merchantId,
          sessionToken,
          expiresAt,
          userAgent,
          ipAddress,
        },
      });
    } catch (error) {
      // Check for unique constraint violation on sessionToken
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        throw new AppError({
          code: ErrorCode.DB_UNIQUE_VIOLATION,
          message: "Session token already exists",
          cause: error,
          metadata: { merchantId },
        });
      }

      // Check for foreign key constraint violation
      if (error instanceof Error && error.message.includes("Foreign key")) {
        throw new AppError({
          code: ErrorCode.DB_FOREIGN_KEY_VIOLATION,
          message: "Merchant not found",
          cause: error,
          metadata: { merchantId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to create session",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Find a session by token
   */
  async findByToken(sessionToken: string): Promise<MerchantSession | null> {
    try {
      return await this.prisma.merchantSession.findUnique({
        where: { sessionToken },
        include: {
          merchant: {
            include: {
              profile: true,
              accounts: true,
            },
          },
        },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to find session by token",
        cause: error,
        metadata: { sessionToken: sessionToken.substring(0, 10) + "..." },
      });
    }
  }

  /**
   * Find all active sessions for a merchant
   */
  async findActiveSessions(merchantId: string): Promise<MerchantSession[]> {
    try {
      const now = new Date();
      return await this.prisma.merchantSession.findMany({
        where: {
          merchantId,
          expiresAt: {
            gt: now,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to find active sessions",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Find all sessions for a merchant (including expired)
   */
  async findByMerchantId(merchantId: string): Promise<MerchantSession[]> {
    try {
      return await this.prisma.merchantSession.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to find sessions by merchant",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Invalidate a session (delete it)
   */
  async invalidate(
    sessionToken: string,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantSession> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantSession.delete({
        where: { sessionToken },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Record to delete does not exist")
      ) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Session not found",
          cause: error,
          metadata: { sessionToken: sessionToken.substring(0, 10) + "..." },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to invalidate session",
        cause: error,
        metadata: { sessionToken: sessionToken.substring(0, 10) + "..." },
      });
    }
  }

  /**
   * Invalidate all sessions for a merchant (logout everywhere)
   */
  async invalidateAll(
    merchantId: string,
    trx?: Prisma.TransactionClient
  ): Promise<{ count: number }> {
    try {
      const db = trx ?? this.prisma;
      const result = await db.merchantSession.deleteMany({
        where: { merchantId },
      });
      return { count: result.count };
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to invalidate all sessions",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Invalidate all expired sessions
   */
  async invalidateExpiredSessions(
    trx?: Prisma.TransactionClient
  ): Promise<{ count: number }> {
    try {
      const db = trx ?? this.prisma;
      const result = await db.merchantSession.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      return { count: result.count };
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to invalidate expired sessions",
        cause: error,
      });
    }
  }

  /**
   * Extend session expiry
   */
  async extendSession(
    sessionToken: string,
    newExpiry: Date,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantSession> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantSession.update({
        where: { sessionToken },
        data: { expiresAt: newExpiry },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Record to update not found")
      ) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Session not found",
          cause: error,
          metadata: { sessionToken: sessionToken.substring(0, 10) + "..." },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to extend session",
        cause: error,
        metadata: { sessionToken: sessionToken.substring(0, 10) + "..." },
      });
    }
  }

  /**
   * Check if a session is valid (exists and not expired)
   */
  async isValid(sessionToken: string): Promise<boolean> {
    try {
      const now = new Date();
      const count = await this.prisma.merchantSession.count({
        where: {
          sessionToken,
          expiresAt: {
            gt: now,
          },
        },
      });
      return count > 0;
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to check session validity",
        cause: error,
        metadata: { sessionToken: sessionToken.substring(0, 10) + "..." },
      });
    }
  }

  /**
   * Clean up expired sessions (bulk delete)
   */
  async cleanupExpired(
    trx?: Prisma.TransactionClient
  ): Promise<{ count: number }> {
    try {
      const db = trx ?? this.prisma;
      const result = await db.merchantSession.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      return { count: result.count };
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to clean up expired sessions",
        cause: error,
      });
    }
  }

  private generateUlid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return timestamp + random;
  }
}
