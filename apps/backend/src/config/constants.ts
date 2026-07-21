import { env } from './env';

export const appConfig = {
    // Server
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    isDev: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    activeMigration: false,

    // Database
    database: {
        url: env.DATABASE_URL,
        urlUnpooled: env.DATABASE_URL_UNPOOLED
    },

    // Redis
    redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        db: env.REDIS_DB,
        bullDb: env.REDIS_BULL_DB
    },

    // Authentication
    auth: {
        jwtSecret: env.JWT_SECRET,
        accessTokenExpiry: env.ACCESS_TOKEN_EXPIRY,
        refreshTokenExpiry: env.REFRESH_TOKEN_EXPIRY,
        sessionExpiry: env.SESSION_EXPIRY,
        pepper: env.PEPPER_SECRET
    },

    // API
    api: {
        keySecret: env.API_KEY_SECRET
    },

    // CORS
    cors: {
        origins: env.CORS_ORIGIN
    },

    // Logging
    logging: {
        level: env.LOG_LEVEL
    },

    // Rate Limiting
    rateLimit: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        maxRequests: env.RATE_LIMIT_MAX_REQUESTS
    }
};
