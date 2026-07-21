import app from './app';
import { logger } from './shared/utils/logger';
import { appConfig } from './config/constants';
import { connectDB, disconnectDB } from './providers/db';
import { connectRedis, disconnectRedis } from './providers/redis';

async function bootstrap() {
    logger.info(`🚀 Initializing Switch Pay core engine on Bun...`);
    logger.info(`📝 Environment: ${appConfig.nodeEnv}`);
    logger.info(`🔧 Port: ${appConfig.port}`);

    await connectDB();
    await connectRedis();

    try {
        const server = Bun.serve({
            port: appConfig.port,
            fetch: app.fetch,
            error(error) {
                const errorLogger = logger.child({
                    error: error.message,
                    stack: error.stack
                });
                errorLogger.error('Bun server error');

                return new Response(
                    JSON.stringify({
                        success: false,
                        error: {
                            message: 'Internal Server Error',
                            timestamp: new Date().toISOString()
                        }
                    }),
                    {
                        status: 500,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );
            }
        });

        logger.info(`✅ Server successfully listening on http://localhost:${server.port}`);
        logger.info(`📊 Health check: http://localhost:${server.port}/health`);
        logger.info(`🔑 Auth routes: http://localhost:${server.port}/auth`);

        const shutdown = async (signal: string) => {
            logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
            server.stop();
            await disconnectDB();
            await disconnectRedis();
            logger.info('✅ Shutdown complete');
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    } catch (error) {
        if (error instanceof Error) {
            logger.error({ err: error }, '❌ Failed to start server');
        } else {
            logger.error({ error }, '❌ Failed to start server');
        }
        await disconnectDB().catch((error) => {
            logger.info('Error disconnecting from the Database', error);
        });
        process.exit(1);
    }
}

bootstrap();
