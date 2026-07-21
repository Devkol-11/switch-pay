import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { AppError } from "../errors/app-error";
import { ResponseHelper } from "../utils/response";
import { logger } from "../utils/logger";

/**
 * Global error handler for Hono
 * Handles all errors that occur during request processing
 */
export function globalErrorHandler(err: unknown, c: Context) {
  const requestId = (c as any).get("requestId") || "unknown";
  const url = c.req.url;
  const method = c.req.method;

  // Log the error with context using child logger
  const errorLogger = logger.child({
    requestId,
    url,
    method,
  });

  if (err instanceof Error) {
    errorLogger.error({ err }, "Request error occurred");
  } else {
    errorLogger.error({ error: err }, "Unknown error occurred");
  }

  // Handle AppError - our custom error type
  if (err instanceof AppError) {
    if (err.shouldLog) {
      const appErrorLogger = logger.child({
        errorId: err.errorId,
        code: err.code,
        timestamp: err.timestamp,
      });
      appErrorLogger.error({ err: err, metadata: err.metadata }, err.message);
    }

    return ResponseHelper.error(c, err);
  }

  // Handle Hono's HTTPException
  if (err instanceof HTTPException) {
    // If it's a validation error
    if (err.status === 400 && err.message?.includes("validation")) {
      return ResponseHelper.validationError(c, []);
    }

    return c.json(
      {
        success: false,
        error: {
          message: err.message,
          status: err.status,
        },
        timestamp: new Date().toISOString(),
      },
      err.status
    );
  }

  // Handle Zod validation errors
  if (err && typeof err === "object" && "issues" in err) {
    return ResponseHelper.validationError(c, (err as any).issues);
  }

  // Handle unknown errors
  errorLogger.error({ err }, "Unhandled error");

  return ResponseHelper.error(c, err);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(c: Context) {
  return ResponseHelper.notFound(
    c,
    `Route ${c.req.method} ${c.req.path} not found`
  );
}
