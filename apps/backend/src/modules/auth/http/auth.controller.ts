import { Context } from "hono";
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  LogoutInput,
  ChangePasswordInput,
  OAuthLoginInput,
  LinkOAuthInput,
  UnlinkOAuthInput,
} from "./auth.schema";
import { AuthService } from "../auth.service";
import { ResponseHelper } from "../../../shared/utils/response";
import { AppError } from "../../../shared/errors/app-error";
import { ErrorCode } from "../../../shared/errors/error-codes";

export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Register a new merchant
   */
  public async register(c: Context) {
    const body = await c.req.json<RegisterInput>();

    const result = await this.authService.register({
      email: body.email,
      password: body.password,
      businessName: body.businessName,
      defaultCurrency: body.defaultCurrency,
      userAgent: c.req.header("user-agent"),
      ipAddress:
        c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip"),
    });

    return ResponseHelper.created(
      c,
      {
        merchant: {
          id: result.merchant.id,
          email: result.merchant.email,
        },
        tokens: result.tokens,
        session: {
          id: result.session.id,
          expiresAt: result.session.expiresAt,
        },
      },
      "Registration successful"
    );
  }

  /**
   * Login with email and password
   */
  public async login(c: Context) {
    const body = await c.req.json<LoginInput>();

    const result = await this.authService.login({
      email: body.email,
      password: body.password,
      userAgent: c.req.header("user-agent"),
      ipAddress:
        c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip"),
    });

    return ResponseHelper.success(
      c,
      {
        merchant: {
          id: result.merchant.id,
          email: result.merchant.email,
        },
        tokens: result.tokens,
        session: {
          id: result.session.id,
          expiresAt: result.session.expiresAt,
        },
      },
      "Login successful"
    );
  }

  /**
   * Login or register with OAuth
   */
  public async oauthLogin(c: Context) {
    const body = await c.req.json<OAuthLoginInput>();

    const result = await this.authService.oauthLogin({
      provider: body.provider,
      providerAccountId: body.providerAccountId,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      tokenExpiresAt: body.tokenExpiresAt,
      email: body.email,
      businessName: body.businessName,
    });

    return ResponseHelper.success(
      c,
      {
        merchant: {
          id: result.merchant.id,
          email: result.merchant.email,
        },
        tokens: result.tokens,
        session: {
          id: result.session.id,
          expiresAt: result.session.expiresAt,
        },
      },
      "OAuth authentication successful"
    );
  }

  /**
   * Refresh access token
   */
  public async refreshTokens(c: Context) {
    const body = await c.req.json<RefreshTokenInput>();

    const tokens = await this.authService.refreshTokens(body.refreshToken);

    return ResponseHelper.success(
      c,
      {
        tokens,
      },
      "Tokens refreshed successfully"
    );
  }

  /**
   * Logout from current session
   */
  public async logout(c: Context) {
    const body = await c.req.json<LogoutInput>();

    await this.authService.logout(body.sessionToken);

    return ResponseHelper.success(c, undefined, "Logged out successfully");
  }

  /**
   * Logout from all devices
   */
  public async logoutAll(c: Context) {
    const merchantId = c.get("merchantId") as string;

    if (!merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_UNAUTHORIZED,
        message: "Unauthorized - No merchant ID found",
      });
    }

    const result = await this.authService.logoutAll(merchantId);

    return ResponseHelper.success(
      c,
      {
        sessionsInvalidated: result.count,
      },
      `Logged out from all ${result.count} devices`
    );
  }

  /**
   * Get all active sessions for the current merchant
   */
  public async getActiveSessions(c: Context) {
    const merchantId = c.get("merchantId") as string;

    if (!merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_UNAUTHORIZED,
        message: "Unauthorized - No merchant ID found",
      });
    }

    const sessions = await this.authService.getActiveSessions(merchantId);

    return ResponseHelper.success(c, {
      sessions: sessions.map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      })),
      count: sessions.length,
    });
  }

  /**
   * Rotate session (create new session, invalidate old)
   */
  public async rotateSession(c: Context) {
    const body = await c.req.json<LogoutInput>();

    const result = await this.authService.rotateSession(
      body.sessionToken,
      c.req.header("user-agent"),
      c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip")
    );

    return ResponseHelper.success(
      c,
      {
        merchant: {
          id: result.merchant.id,
          email: result.merchant.email,
        },
        tokens: result.tokens,
        session: {
          id: result.session.id,
          expiresAt: result.session.expiresAt,
        },
      },
      "Session rotated successfully"
    );
  }

  /**
   * Change password
   */
  public async changePassword(c: Context) {
    const merchantId = c.get("merchantId") as string;

    if (!merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_UNAUTHORIZED,
        message: "Unauthorized - No merchant ID found",
      });
    }

    const body = await c.req.json<ChangePasswordInput>();

    await this.authService.changePassword(
      merchantId,
      body.currentPassword,
      body.newPassword
    );

    return ResponseHelper.success(
      c,
      undefined,
      "Password changed successfully"
    );
  }

  /**
   * Reset password (forgot password flow)
   */
  public async resetPassword(c: Context) {
    const merchantId = c.get("merchantId") as string;

    if (!merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_UNAUTHORIZED,
        message: "Unauthorized - No merchant ID found",
      });
    }

    const body = await c.req.json<{ newPassword: string }>();

    await this.authService.resetPassword(merchantId, body.newPassword);

    return ResponseHelper.success(c, undefined, "Password reset successfully");
  }

  /**
   * Check if merchant has password
   */
  public async hasPassword(c: Context) {
    const merchantId = c.get("merchantId") as string;

    if (!merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_UNAUTHORIZED,
        message: "Unauthorized - No merchant ID found",
      });
    }

    const hasPassword = await this.authService.hasPassword(merchantId);

    return ResponseHelper.success(c, {
      hasPassword,
    });
  }

  /**
   * Link OAuth account to existing merchant
   */
  public async linkOAuth(c: Context) {
    const merchantId = c.get("merchantId") as string;

    if (!merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_UNAUTHORIZED,
        message: "Unauthorized - No merchant ID found",
      });
    }

    const body = await c.req.json<LinkOAuthInput>();

    const account = await this.authService.linkOAuth(
      merchantId,
      body.provider,
      body.providerAccountId,
      body.accessToken,
      body.refreshToken,
      body.tokenExpiresAt
    );

    return ResponseHelper.success(
      c,
      {
        account: {
          id: account.id,
          provider: account.provider,
          type: account.type,
        },
      },
      "OAuth account linked successfully"
    );
  }

  /**
   * Unlink OAuth account
   */
  public async unlinkOAuth(c: Context) {
    const merchantId = c.get("merchantId") as string;

    if (!merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_UNAUTHORIZED,
        message: "Unauthorized - No merchant ID found",
      });
    }

    const body = await c.req.json<UnlinkOAuthInput>();

    await this.authService.unlinkOAuth(merchantId, body.accountId);

    return ResponseHelper.success(
      c,
      undefined,
      "OAuth account unlinked successfully"
    );
  }

  /**
   * Get current merchant profile
   */
  public async getProfile(c: Context) {
    const merchantId = c.get("merchantId") as string;

    if (!merchantId) {
      throw new AppError({
        code: ErrorCode.AUTH_UNAUTHORIZED,
        message: "Unauthorized - No merchant ID found",
      });
    }

    // This would need to be implemented in your service
    return ResponseHelper.success(c, {
      merchantId,
    });
  }
}
