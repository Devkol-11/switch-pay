// src/utils/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
});

// Child logger with context
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

// Request logger - creates a child logger for each request
export function createRequestLogger(
  requestId: string,
  path: string,
  method: string
) {
  return logger.child({
    requestId,
    path,
    method,
  });
}

// Export types
export type Logger = typeof logger;
