import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { appConfig } from "../config/constants.js";
import { logger } from "../shared/utils/logger.js";

interface SslMode {
  rejectUnauthorized: boolean;
  sslmode: "require" | "verify-full";
}

const { Pool } = pg;
// ============== SSL CONFIGURATION ==============
const getSslConfig = (): SslMode => {
  // In development, we use relaxed SSL
  if (appConfig.isDev) {
    return {
      rejectUnauthorized: false,
      // Explicitly use 'require' mode for development
      sslmode: "require",
    };
  }

  // In production, use strict SSL
  return {
    rejectUnauthorized: true,
    sslmode: "verify-full",
  };
};

// ============== CONNECTION STRING ==============
// Determine which connection string to use
const connectionString = appConfig.activeMigration
  ? appConfig.database.urlUnpooled
  : appConfig.database.url;

// ============== POOL CONFIGURATION ==============
const getPoolConfig = () => ({
  connectionString,
  connectionTimeoutMillis: appConfig.isDev ? 10_000 : 20_000,
  idleTimeoutMillis: appConfig.isDev ? 30_000 : 60_000,
  max: appConfig.isDev ? 3 : 10,
  ssl: getSslConfig(),
});

// ============== GLOBAL INSTANCE CACHING ==============
// Prevent socket ghosting across hot-reloads
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
};

let pool: pg.Pool;
let dbClient: PrismaClient;

// ============== INITIALIZE DATABASE CLIENT ==============
if (appConfig.isDev) {
  // Development: Use cached instances
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new Pool(getPoolConfig());
  }
  pool = globalForPrisma.pgPool;

  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg(pool as any);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  dbClient = globalForPrisma.prisma;
} else {
  // Production: Fresh instances
  pool = new Pool(getPoolConfig());
  const adapter = new PrismaPg(pool as any);
  dbClient = new PrismaClient({ adapter });
}

// ============== DATABASE CONNECTION ==============
async function pingWithRetry(retries = 3, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await dbClient.$queryRaw`SELECT 1`;
      logger.info("🚀 Database connection verified");
      return;
    } catch (error) {
      if (attempt < retries) {
        logger.warn(
          {
            attempt,
            retries,
            delayMs,
            error: error instanceof Error ? error.message : String(error),
          },
          `Database ping attempt ${attempt} failed, retrying...`
        );
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          "Database connection failed after all retries"
        );
        throw error;
      }
    }
  }
}

export async function connectDB() {
  logger.info("Connecting to PostgreSQL...");

  const connectPromise = dbClient.$connect();
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error("Prisma $connect() timed out after 15s")),
      15_000
    );
  });

  try {
    await Promise.race([connectPromise, timeoutPromise]);
    logger.info("✅ PostgreSQL connected successfully");
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "PostgreSQL connection failed"
    );
    throw error;
  }

  await pingWithRetry();
}

export function getClient() {
  return dbClient;
}

export async function disconnectDB() {
  logger.info("Disconnecting from PostgreSQL...");
  await dbClient.$disconnect();
  await pool.end();
  logger.info("✅ PostgreSQL disconnected");
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await dbClient.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Database health check failed"
    );
    return false;
  }
}
