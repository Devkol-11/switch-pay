import { cors } from "hono/cors";

/**
 * CORS configuration for the application
 */
export function configureCors() {
  return cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86400, // 24 hours
  });
}
