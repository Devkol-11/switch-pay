import { Context } from "hono";
import { StatusCode } from "hono/utils/http-status";
import { AppError } from "../errors/app-error";
import { HttpStatus } from "../errors/http-status";

// Helper type for Hono's status codes
type HonoStatus = StatusCode;

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    errorId?: string;
    code?: string;
    message: string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}

export class ResponseHelper {
  /**
   * Send a success response
   */
  static success<T>(
    c: Context,
    data?: T,
    message: string = "Operation successful",
    status: HonoStatus = HttpStatus.OK
  ) {
    const response: ApiResponse<T> = {
      success: true,
      message,
      timestamp: new Date().toISOString(),
    };

    if (data !== undefined) {
      response.data = data;
    }

    return c.json(response, HttpStatus.OK);
  }

  /**
   * Send a success response with pagination
   */
  static paginated<T>(
    c: Context,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    message: string = "Data retrieved successfully"
  ) {
    const response: ApiResponse<T[]> = {
      success: true,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString(),
    };

    return c.json(response, HttpStatus.OK);
  }

  /**
   * Send a created response (201)
   */
  static created<T>(
    c: Context,
    data?: T,
    message: string = "Resource created successfully"
  ) {
    return this.success(c, data, message, HttpStatus.CREATED as HonoStatus);
  }

  /**
   * Send a no content response (204)
   */
  static noContent(c: Context) {
    return c.body(null, HttpStatus.NO_CONTENT);
  }

  /**
   * Send an error response
   */
  static error(
    c: Context,
    error: unknown,
    status: HonoStatus = HttpStatus.INTERNAL_SERVER_ERROR
  ) {
    // Handle AppError
    if (error instanceof AppError) {
      const response: ApiResponse = {
        success: false,
        error: {
          errorId: error.errorId,
          code: error.code,
          message: error.message,
          ...(error.metadata && { metadata: error.metadata }),
          timestamp: error.timestamp.toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      return c.json(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Handle standard Error objects
    if (error instanceof Error) {
      const response: ApiResponse = {
        success: false,
        error: {
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      return c.json(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Handle unknown errors
    const response: ApiResponse = {
      success: false,
      error: {
        message: "An unexpected error occurred",
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /**
   * Send a validation error response
   */
  static validationError(c: Context, issues: unknown[]) {
    const response: ApiResponse = {
      success: false,
      error: {
        message: "Validation failed",
        metadata: { issues },
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, HttpStatus.BAD_REQUEST);
  }

  /**
   * Send a not found response
   */
  static notFound(c: Context, message: string = "Resource not found") {
    const response: ApiResponse = {
      success: false,
      error: {
        message,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, HttpStatus.NOT_FOUND);
  }

  /**
   * Send an unauthorized response
   */
  static unauthorized(c: Context, message: string = "Unauthorized") {
    const response: ApiResponse = {
      success: false,
      error: {
        message,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, HttpStatus.UNAUTHORIZED);
  }

  /**
   * Send a forbidden response
   */
  static forbidden(c: Context, message: string = "Forbidden") {
    const response: ApiResponse = {
      success: false,
      error: {
        message,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, HttpStatus.FORBIDDEN);
  }

  /**
   * Send a conflict response
   */
  static conflict(c: Context, message: string = "Resource conflict") {
    const response: ApiResponse = {
      success: false,
      error: {
        message,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, HttpStatus.CONFLICT);
  }

  /**
   * Send a too many requests response
   */
  static tooManyRequests(c: Context, message: string = "Too many requests") {
    const response: ApiResponse = {
      success: false,
      error: {
        message,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, HttpStatus.TOO_MANY_REQUESTS);
  }
}

// Shortcut exports for convenience
export const {
  success,
  created,
  noContent,
  error,
  validationError,
  notFound,
  unauthorized,
  forbidden,
  conflict,
  tooManyRequests,
  paginated,
} = ResponseHelper;
