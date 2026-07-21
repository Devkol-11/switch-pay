import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { appConfig } from '../config/constants.js';
import { logger } from '../shared/utils/logger.js';

const { Pool } = pg;

// ============== CONNECTION STRING ==============
const connectionString = appConfig.activeMigration
    ? appConfig.database.urlUnpooled
    : appConfig.database.url;

// ============== POOL CONFIGURATION ==============
const getPoolConfig = (): pg.PoolConfig => ({
    connectionString,
    connectionTimeoutMillis: appConfig.isDev ? 10_000 : 20_000,
    idleTimeoutMillis: appConfig.isDev ? 30_000 : 60_000,
    max: appConfig.isDev ? 3 : 10,

    // Local Docker/Postgres does not use SSL.
    // Enable SSL only outside development.
    ssl: appConfig.isDev
        ? false
        : {
              rejectUnauthorized: true
          }
});

// ============== GLOBAL INSTANCE CACHING ==============
const globalForPrisma = globalThis as {
    prisma?: PrismaClient;
    pgPool?: pg.Pool;
};

let pool: pg.Pool;
let dbClient: PrismaClient;

// ============== INITIALIZE DATABASE CLIENT ==============
if (appConfig.isDev) {
    if (!globalForPrisma.pgPool) {
        globalForPrisma.pgPool = new Pool(getPoolConfig());
    }

    pool = globalForPrisma.pgPool;

    if (!globalForPrisma.prisma) {
        const adapter = new PrismaPg(pool);
        globalForPrisma.prisma = new PrismaClient({ adapter });
    }

    dbClient = globalForPrisma.prisma;
} else {
    pool = new Pool(getPoolConfig());
    const adapter = new PrismaPg(pool);
    dbClient = new PrismaClient({ adapter });
}

// ============== DATABASE CONNECTION ==============
async function pingWithRetry(retries = 3, delayMs = 3000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await dbClient.$queryRaw`SELECT 1`;
            logger.info('✅ Database connection verified');
            return;
        } catch (error) {
            if (attempt === retries) {
                logger.error(
                    {
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined
                    },
                    'Database connection failed after all retries'
                );
                throw error;
            }

            logger.warn(
                {
                    attempt,
                    retries,
                    delayMs,
                    error: error instanceof Error ? error.message : String(error)
                },
                `Database ping attempt ${attempt} failed, retrying...`
            );

            await Bun.sleep(delayMs);
        }
    }
}

export async function connectDB() {
    logger.info('Connecting to PostgreSQL...');

    try {
        await Promise.race([
            dbClient.$connect(),
            Bun.sleep(15_000).then(() => {
                throw new Error('Prisma $connect() timed out after 15 seconds');
            })
        ]);

        logger.info('✅ PostgreSQL connected successfully');

        await pingWithRetry();
    } catch (error) {
        logger.error(
            {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            },
            'PostgreSQL connection failed'
        );

        throw error;
    }
}

export function getClient() {
    return dbClient;
}

export async function disconnectDB() {
    logger.info('Disconnecting from PostgreSQL...');

    await dbClient.$disconnect();
    await pool.end();

    logger.info('✅ PostgreSQL disconnected');
}

export async function checkDatabaseHealth(): Promise<boolean> {
    try {
        await dbClient.$queryRaw`SELECT 1`;
        return true;
    } catch (error) {
        logger.error(
            {
                error: error instanceof Error ? error.message : String(error)
            },
            'Database health check failed'
        );

        return false;
    }
}
