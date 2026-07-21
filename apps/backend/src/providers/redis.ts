import Redis, { RedisOptions } from 'ioredis';
import { appConfig } from '../config/constants.js';
import { logger } from '../shared/utils/logger.js';

type RedisClientName = 'redis' | 'bullmq';

type RedisGlobal = typeof globalThis & {
    redisClient?: Redis;
    bullMqRedisClient?: Redis;
};

const globalForRedis = globalThis as RedisGlobal;

const baseRedisConfig = {
    host: appConfig.redis.host,
    port: appConfig.redis.port,
    lazyConnect: true
};

const redisConfig = {
    ...baseRedisConfig,
    db: appConfig.redis.db,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3
};

const bullMqRedisConfig = {
    ...baseRedisConfig,
    db: appConfig.redis.bullDb,
    enableReadyCheck: false,
    maxRetriesPerRequest: null
};

function createRedisClient(name: RedisClientName, options: RedisOptions) {
    const client = new Redis(options);

    client.on('connect', () => {
        logger.info({ service: name }, `${name} Redis client connected`);
    });

    client.on('ready', () => {
        logger.info({ service: name }, `${name} Redis client is ready`);
    });

    client.on('error', (error) => {
        logger.error({ service: name, error }, `${name} Redis client error`);
    });

    return client;
}

export const redisClient = globalForRedis.redisClient ?? createRedisClient('redis', redisConfig);

export const bullMqRedisClient =
    globalForRedis.bullMqRedisClient ?? createRedisClient('bullmq', bullMqRedisConfig);

if (!globalForRedis.redisClient) {
    globalForRedis.redisClient = redisClient;
}

if (!globalForRedis.bullMqRedisClient) {
    globalForRedis.bullMqRedisClient = bullMqRedisClient;
}

export async function connectRedis() {
    logger.info('Connecting to Redis services...');
    await Promise.all([redisClient.connect(), bullMqRedisClient.connect()]);
    logger.info('✅ Redis services connected');
}

export async function disconnectRedis() {
    logger.info('Disconnecting from Redis services...');
    await Promise.all([
        redisClient.quit().catch(() => undefined),
        bullMqRedisClient.quit().catch(() => undefined)
    ]);
    logger.info('✅ Redis services disconnected');
}

export function getRedisClient() {
    return redisClient;
}

export function getBullMqRedisClient() {
    return bullMqRedisClient;
}

export async function checkRedisHealth() {
    try {
        const [redisPong, bullPong] = await Promise.all([
            redisClient.ping(),
            bullMqRedisClient.ping()
        ]);

        return redisPong === 'PONG' && bullPong === 'PONG';
    } catch (error) {
        logger.error({ error }, 'Redis health check failed');
        return false;
    }
}
