import { OAuthProvider } from "../../generated/prisma/enums";
import { Merchant, MerchantSession } from "../../generated/prisma/client";
import { JWTPayload } from "jose";

// ============== TYPES ==============

export interface RegisterData {
  email: string;
  password: string;
  businessName: string;
  defaultCurrency?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface LoginData {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface OAuthLoginData {
  provider: OAuthProvider;
  providerAccountId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  email: string;
  businessName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  merchant: Merchant;
  tokens: AuthTokens;
  session: MerchantSession;
}

export interface TokenPayload extends JWTPayload {
  merchantId: string;
  sessionId: string;
  type: "access" | "refresh";
}

// ============== CONFIGURATION ==============

export interface AuthConfig {
  jwtSecret: string;
  accessTokenExpiry: number; // in seconds
  refreshTokenExpiry: number; // in seconds
  sessionExpiry: number; // in seconds
  pepper: string; // Additional secret for password hashing
}

// ============== MAIN SERVICE ==============
