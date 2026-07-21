// src/modules/auth/auth.routes.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
    registerSchema,
    loginSchema,
    refreshTokenSchema,
    logoutSchema,
    changePasswordSchema,
    oauthLoginSchema,
    linkOAuthSchema,
    unlinkOAuthSchema
} from './auth.schema';
import { AuthController } from './auth.controller';
import { AuthService } from '../auth.service';
import { getClient } from '../../../providers/db';
import { AuthConfig } from '../auth.types';
import { authenticate } from '../../../shared/middleware/auth';
import { env } from '../../../config/env';

const authRouter = new Hono();

// Initialize dependencies
const prisma = getClient();

const config: AuthConfig = {
    jwtSecret: env.JWT_SECRET || 'your-secret-key-change-in-production',
    accessTokenExpiry: env.ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiry: env.REFRESH_TOKEN_EXPIRY,
    sessionExpiry: env.SESSION_EXPIRY,
    pepper: env.PEPPER_SECRET || 'your-pepper-secret-change-in-production'
};

const authService = new AuthService(prisma, config);
const authController = new AuthController(authService);

// ============== PUBLIC ROUTES ==============

authRouter.post('/register', zValidator('json', registerSchema), async (c) =>
    authController.register(c)
);

authRouter.post('/login', zValidator('json', loginSchema), async (c) => authController.login(c));

authRouter.post('/oauth/login', zValidator('json', oauthLoginSchema), async (c) =>
    authController.oauthLogin(c)
);

authRouter.post('/refresh', zValidator('json', refreshTokenSchema), async (c) =>
    authController.refreshTokens(c)
);

// ============== PROTECTED ROUTES ==============

authRouter.use('/profile', authenticate);
authRouter.use('/logout', authenticate);
authRouter.use('/logout-all', authenticate);
authRouter.use('/sessions', authenticate);
authRouter.use('/session/rotate', authenticate);
authRouter.use('/password/*', authenticate);
authRouter.use('/oauth/link', authenticate);
authRouter.use('/oauth/unlink', authenticate);

authRouter.post('/logout', zValidator('json', logoutSchema), async (c) => authController.logout(c));

authRouter.post('/logout-all', async (c) => authController.logoutAll(c));

authRouter.get('/sessions', async (c) => authController.getActiveSessions(c));

authRouter.post('/session/rotate', zValidator('json', logoutSchema), async (c) =>
    authController.rotateSession(c)
);

authRouter.post('/password/change', zValidator('json', changePasswordSchema), async (c) =>
    authController.changePassword(c)
);

authRouter.post(
    '/password/reset',
    zValidator('json', changePasswordSchema.pick({ newPassword: true })),
    async (c) => authController.resetPassword(c)
);

authRouter.get('/password/status', async (c) => authController.hasPassword(c));

authRouter.post('/oauth/link', zValidator('json', linkOAuthSchema), async (c) =>
    authController.linkOAuth(c)
);

authRouter.delete('/oauth/unlink', zValidator('json', unlinkOAuthSchema), async (c) =>
    authController.unlinkOAuth(c)
);

authRouter.get('/profile', async (c) => authController.getProfile(c));

export { authRouter };
