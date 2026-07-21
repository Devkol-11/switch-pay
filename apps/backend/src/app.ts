import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import {
    globalErrorHandler,
    notFoundHandler,
    addRequestId,
    configureCors
} from './shared/middleware/index';
import { healthRouter } from './health/health.routes';
import { authRouter } from './modules/auth/http/auth.routes';
import { credentialsRouter } from './modules/credentials/credentials.routes';
import { logger } from './shared/utils/logger';

const app = new Hono();

app.use('*', honoLogger());
app.use('*', configureCors());
app.use('*', addRequestId);
app.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    c.res.headers.set('X-Response-Time', `${duration}ms`);

    // Log slow requests with child logger
    if (duration > 1000) {
        const requestId = (c as any).get('requestId') || 'unknown';
        const slowLogger = logger.child({
            path: c.req.path,
            method: c.req.method,
            duration,
            requestId
        });
        slowLogger.warn('Slow request detected');
    }
});

// ============== GLOBAL ERROR HANDLING ==============

app.onError(globalErrorHandler);
app.notFound(notFoundHandler);

// ============== ROUTES ==============

app.route('/health', healthRouter);
app.route('/auth', authRouter);
app.route('/credentials', credentialsRouter);

export default app;
