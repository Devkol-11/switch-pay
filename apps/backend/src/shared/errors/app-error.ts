import { ErrorCode } from "./error-codes";
import { HttpStatus } from "./http-status";
import { ErrorCodeMapping, ErrorMapping } from "./error-mapping";

export interface AppErrorOptions {
  code: ErrorCode;
  message?: string;
  status?: HttpStatus;
  cause?: unknown;
  metadata?: Record<string, unknown>;
  shouldLog?: boolean;
  shouldRetry?: boolean;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: HttpStatus;
  public readonly cause?: unknown;
  public readonly metadata?: Record<string, unknown>;
  public readonly shouldLog: boolean;
  public readonly shouldRetry: boolean;
  public readonly timestamp: Date;
  public readonly errorId: string;

  constructor(options: AppErrorOptions) {
    const mapping = ErrorCodeMapping[options.code];

    // Build error message
    const message =
      options.message || mapping?.message || "An unexpected error occurred";
    super(message);

    // Set prototype for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);

    this.name = "AppError";
    this.code = options.code;
    this.status =
      options.status || mapping?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    this.cause = options.cause;
    this.metadata = options.metadata;
    this.shouldLog = options.shouldLog ?? mapping?.shouldLog ?? true;
    this.shouldRetry = options.shouldRetry ?? mapping?.shouldRetry ?? false;
    this.timestamp = new Date();
    this.errorId = this.generateErrorId();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Ensure proper logging of cause
    if (this.cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${this.cause.stack}`;
    }
  }

  /**
   * Generate a unique error ID for tracking
   */
  private generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ERR-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, unknown> {
    return {
      errorId: this.errorId,
      code: this.code,
      message: this.message,
      status: this.status,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata,
      // Only include stack in development
      ...(process.env.NODE_ENV !== "production" && { stack: this.stack }),
    };
  }

  /**
   * Get the HTTP status code
   */
  getStatusCode(): HttpStatus {
    return this.status;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.shouldRetry;
  }

  /**
   * Check if error should be logged
   */
  isLoggable(): boolean {
    return this.shouldLog;
  }

  /**
   * Get error category
   */
  getCategory(): string {
    return this.code.split("-")[0];
  }

  /**
   * Check if error matches a specific code
   */
  is(code: ErrorCode): boolean {
    return this.code === code;
  }

  /**
   * Check if error matches any of the given codes
   */
  isAny(codes: ErrorCode[]): boolean {
    return codes.includes(this.code);
  }

  /**
   * Check if error is in a specific category
   */
  isCategory(category: string): boolean {
    return this.getCategory() === category;
  }
}

// ============== ERROR FACTORIES ==============

export class AppErrorFactory {
  /**
   * Create an authentication error
   */
  static auth(
    code: ErrorCode,
    message?: string,
    metadata?: Record<string, unknown>
  ): AppError {
    return new AppError({ code, message, metadata });
  }

  static validation(
    code: ErrorCode,
    message: string,
    metadata?: Record<string, string>
  ): AppError {
    return new AppError({ code, message, metadata });
  }
}
