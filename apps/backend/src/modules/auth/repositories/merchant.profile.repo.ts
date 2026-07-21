// src/repositories/merchant-profile.repo.ts
import {
  PrismaClient,
  MerchantProfile,
  Prisma,
} from "../../../generated/prisma/client";
import { AppError } from "../../../shared/errors/app-error";
import { ErrorCode } from "../../../shared/errors/error-codes";

export class MerchantProfileRepo {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find profile by merchant ID
   */
  async findByMerchantId(merchantId: string): Promise<MerchantProfile | null> {
    try {
      return await this.prisma.merchantProfile.findUnique({
        where: { merchantId },
        include: {
          merchant: {
            include: {
              accounts: true,
            },
          },
        },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to find profile by merchant ID",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Create a new profile for a merchant
   */
  async create(
    merchantId: string,
    businessName: string,
    defaultCurrency: string = "NGN",
    logoUrl?: string,
    dashboardPreferences?: any,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantProfile> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantProfile.create({
        data: {
          id: this.generateUlid(),
          merchantId,
          businessName,
          defaultCurrency,
          logoUrl,
          dashboardPreferences,
        },
      });
    } catch (error) {
      // Check for unique constraint violation (merchantId is unique)
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        throw new AppError({
          code: ErrorCode.DB_UNIQUE_VIOLATION,
          message: "Profile already exists for this merchant",
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
        message: "Failed to create merchant profile",
        cause: error,
        metadata: { merchantId, businessName },
      });
    }
  }

  /**
   * Update profile information
   */
  async update(
    merchantId: string,
    data: {
      businessName?: string;
      defaultCurrency?: string;
      logoUrl?: string;
      dashboardPreferences?: any;
    },
    trx?: Prisma.TransactionClient
  ): Promise<MerchantProfile> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantProfile.update({
        where: { merchantId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Record to update not found")
      ) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Profile not found for this merchant",
          cause: error,
          metadata: { merchantId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to update merchant profile",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Update business name
   */
  async updateBusinessName(
    merchantId: string,
    businessName: string,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantProfile> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantProfile.update({
        where: { merchantId },
        data: { businessName },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Record to update not found")
      ) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Profile not found for this merchant",
          cause: error,
          metadata: { merchantId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to update business name",
        cause: error,
        metadata: { merchantId, businessName },
      });
    }
  }

  /**
   * Update default currency
   */
  async updateCurrency(
    merchantId: string,
    defaultCurrency: string,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantProfile> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantProfile.update({
        where: { merchantId },
        data: { defaultCurrency },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Record to update not found")
      ) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Profile not found for this merchant",
          cause: error,
          metadata: { merchantId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to update currency",
        cause: error,
        metadata: { merchantId, defaultCurrency },
      });
    }
  }

  /**
   * Update logo URL
   */
  async updateLogo(
    merchantId: string,
    logoUrl: string,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantProfile> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantProfile.update({
        where: { merchantId },
        data: { logoUrl },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Record to update not found")
      ) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Profile not found for this merchant",
          cause: error,
          metadata: { merchantId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to update logo",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Update dashboard preferences
   */
  async updateDashboardPreferences(
    merchantId: string,
    dashboardPreferences: any,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantProfile> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantProfile.update({
        where: { merchantId },
        data: { dashboardPreferences },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Record to update not found")
      ) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Profile not found for this merchant",
          cause: error,
          metadata: { merchantId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to update dashboard preferences",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Get profile with merchant details
   */
  async getProfileWithMerchant(
    merchantId: string
  ): Promise<MerchantProfile | null> {
    try {
      return await this.prisma.merchantProfile.findUnique({
        where: { merchantId },
        include: {
          merchant: {
            include: {
              accounts: true,
              sessions: {
                where: {
                  expiresAt: {
                    gt: new Date(),
                  },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to fetch profile with merchant details",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Delete profile
   */
  async delete(
    merchantId: string,
    trx?: Prisma.TransactionClient
  ): Promise<MerchantProfile> {
    try {
      const db = trx ?? this.prisma;
      return await db.merchantProfile.delete({
        where: { merchantId },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Record to delete does not exist")
      ) {
        throw new AppError({
          code: ErrorCode.RES_NOT_FOUND,
          message: "Profile not found for this merchant",
          cause: error,
          metadata: { merchantId },
        });
      }

      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to delete profile",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Check if profile exists for a merchant
   */
  async exists(merchantId: string): Promise<boolean> {
    try {
      const count = await this.prisma.merchantProfile.count({
        where: { merchantId },
      });
      return count > 0;
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to check if profile exists",
        cause: error,
        metadata: { merchantId },
      });
    }
  }

  /**
   * Get profile by business name (partial match)
   */
  async findByBusinessName(businessName: string): Promise<MerchantProfile[]> {
    try {
      return await this.prisma.merchantProfile.findMany({
        where: {
          businessName: {
            contains: businessName,
            mode: "insensitive",
          },
        },
        include: {
          merchant: true,
        },
      });
    } catch (error) {
      throw new AppError({
        code: ErrorCode.DB_QUERY_FAILED,
        message: "Failed to find profiles by business name",
        cause: error,
        metadata: { businessName },
      });
    }
  }

  private generateUlid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return timestamp + random;
  }
}
