import { z } from "zod";

// Base schemas
export const registerSchema = z.object({
  businessName: z
    .string()
    .min(2, "Business name must be at least 2 characters"),
  email: z.string().email("Invalid business email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  defaultCurrency: z.enum(["NGN", "USD", "EUR", "GBP"]).default("NGN"),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const logoutSchema = z.object({
  sessionToken: z.string().min(1, "Session token is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(8, "Current password must be at least 8 characters"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
});

export const oauthLoginSchema = z.object({
  provider: z.enum(["google", "github"]),
  providerAccountId: z.string().min(1, "Provider account ID is required"),
  accessToken: z.string().min(1, "Access token is required"),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  email: z.string().email("Invalid email address"),
  businessName: z
    .string()
    .min(2, "Business name must be at least 2 characters"),
});

export const linkOAuthSchema = z.object({
  provider: z.enum(["google", "github"]),
  providerAccountId: z.string().min(1, "Provider account ID is required"),
  accessToken: z.string().min(1, "Access token is required"),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

export const unlinkOAuthSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type OAuthLoginInput = z.infer<typeof oauthLoginSchema>;
export type LinkOAuthInput = z.infer<typeof linkOAuthSchema>;
export type UnlinkOAuthInput = z.infer<typeof unlinkOAuthSchema>;
