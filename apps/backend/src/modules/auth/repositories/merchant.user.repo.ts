// src/repositories/merchant-user.repo.ts
import {
  PrismaClient,
  Merchant,
  Prisma,
} from "../../../generated/prisma/client";
import { AppError } from "../../../shared/errors/app-error";
import { ErrorCode } from "../../../shared/errors/error-codes";

export class MerchantUserRepo {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find a merchant by email
   */
  async findByEmail(email: string): Promise<Merchant | null> {
    try {
      return await this.prisma.merchant.findUnique({
        where: { email },
        include: {
          profile: true,
          accounts: true,
        },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to find merchant by email",
        cause: error,
        metadata: { email },
      });
    }
  }

  /**
   * Find a merchant by ID
   */
  async findById(id: string): Promise<Merchant | null> {
    try {
      return await this.prisma.merchant.findUnique({
        where: { id },
        include: {
          profile: true,
          accounts: true,
        },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to find merchant by ID",
        cause: error,
        metadata: { id },
      });
    }
  }

  /**
   * Create a new merchant
   */
  async create(
    data: { email: string },
    trx?: Prisma.TransactionClient
  ): Promise<Merchant> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchant.create({
        data: {
          id: this.generateUlid(),
          email: data.email,
        },
      });
    } catch (error) {
      // Check for unique constraint violation on email
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        throw new AppError({
          code: ErrorCode.DB_UNIQUE_VIOLATION,
          message: "Merchant with this email already exists",
          cause: error,
          metadata: { email: data.email },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to create merchant",
        cause: error,
        metadata: { email: data.email },
      });
    }
  }

  /**
   * Update merchant email
   */
  async updateEmail(
    id: string,
    email: string,
    trx?: Prisma.TransactionClient
  ): Promise<Merchant> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchant.update({
        where: { id },
        data: { email },
      });
    } catch (error) {
      // Check for record not found
      if (
        error instanceof Error &&
        error.message.includes("Record to update not found")
      ) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Merchant not found",
          cause: error,
          metadata: { id },
        });
      }

      // Check for unique constraint violation on email
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        throw new AppError({
          code: ErrorCode.DB_UNIQUE_VIOLATION,
          message: "Email already in use by another merchant",
          cause: error,
          metadata: { id, email },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to update merchant email",
        cause: error,
        metadata: { id, email },
      });
    }
  }

  /**
   * Delete a merchant (soft delete not implemented, cascade will handle relations)
   */
  async delete(id: string, trx?: Prisma.TransactionClient): Promise<Merchant> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchant.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Record to delete does not exist")
      ) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Merchant not found",
          cause: error,
          metadata: { id },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to delete merchant",
        cause: error,
        metadata: { id },
      });
    }
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    try {
      const count = await this.prisma.merchant.count({
        where: { email },
      });
      return count > 0;
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to check if email exists",
        cause: error,
        metadata: { email },
      });
    }
  }

  /**
   * Generate ULID (simplified version, use a proper ULID library in production)
   */
  private generateUlid(): string {
    // In production, use: import { ulid } from 'ulid'
    // For now, using timestamp + random chars
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return timestamp + random;
  }
}
