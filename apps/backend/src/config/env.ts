import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const envSchema = z.object({
    // ============== DATABASE ==============
    DATABASE_URL: z.url(),
    DATABASE_URL_UNPOOLED: z.url().optional(),

    // ============== REDIS ==============
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default(6379),
    REDIS_DB: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default(0),
    REDIS_BULL_DB: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default(1),

    // ============== SERVER ==============
    PORT: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // ============== AUTHENTICATION ==============
    JWT_SECRET: z
        .string()
        .min(32, 'JWT_SECRET must be at least 32 characters long')
        .default('your-super-secret-jwt-key-min-32-chars-here'),

    ACCESS_TOKEN_EXPIRY: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default(900), // 15 minutes

    REFRESH_TOKEN_EXPIRY: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default(604800), // 7 days

    SESSION_EXPIRY: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default(604800), // 7 days

    PEPPER_SECRET: z
        .string()
        .min(32, 'PEPPER_SECRET must be at least 32 characters long')
        .default('your-super-secret-pepper-key-min-32-chars-here'),

    // ============== API KEYS ==============
    API_KEY_SECRET: z
        .string()
        .min(32, 'API_KEY_SECRET must be at least 32 characters long')
        .default('your-api-key-secret-min-32-chars-here'),

    // ============== CORS ==============
    CORS_ORIGIN: z
        .string()
        .default('*')
        .transform((val) => val.split(',').map((origin) => origin.trim())),

    // ============== LOGGING ==============
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

    // ============== RATE LIMITING (Optional) ==============
    RATE_LIMIT_WINDOW_MS: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default(60000), // 1 minute

    RATE_LIMIT_MAX_REQUESTS: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default(100) // 100 requests per window
});

export type EnvConfig = z.infer<typeof envSchema>;

// Check if the current execution string is Prisma running code generation
const isPrismaCLI =
    process.env.npm_lifecycle_script === 'prisma' ||
    process.argv.some((arg) => arg.includes('prisma'));

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    if (isPrismaCLI) {
        // Gracefully fallback with mock data so Prisma can finish compiling types
        console.log('ℹ️ Prisma environment isolation active: Using compilation pass-through.');
    } else {
        console.error('❌ Invalid environment configuration:', parsed.error.format());
        process.exit(1);
    }
}

// Export parsed data if successful, otherwise export a fallback proxy object for Prisma's compilation phase
export const env = parsed.success
    ? parsed.data
    : {
          DATABASE_URL: process.env.DATABASE_URL || 'postgresql://mock:mock@localhost:5432/mock',
          DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
          REDIS_HOST: process.env.REDIS_HOST || 'localhost',
          REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
          REDIS_DB: parseInt(process.env.REDIS_DB || '0', 10),
          REDIS_BULL_DB: parseInt(process.env.REDIS_BULL_DB || '1', 10),
          PORT: 3000,
          NODE_ENV: 'development' as const,
          JWT_SECRET: 'mock_jwt_secret_for_compilation_pass',
          ACCESS_TOKEN_EXPIRY: 900,
          REFRESH_TOKEN_EXPIRY: 604800,
          SESSION_EXPIRY: 604800,
          PEPPER_SECRET: 'mock_pepper_secret_for_compilation_pass',
          API_KEY_SECRET: 'mock_api_key_secret_for_compilation_pass',
          CORS_ORIGIN: ['*'],
          LOG_LEVEL: 'info' as const,
          RATE_LIMIT_WINDOW_MS: 60000,
          RATE_LIMIT_MAX_REQUESTS: 100
      };
