/**
 * Custom error classes for the application.
 * These provide structured error handling with codes and HTTP status mappings.
 */

/** Error codes used throughout the application */
export const ErrorCode = {
  // Authentication errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  LICENSE_REQUIRED: 'LICENSE_REQUIRED',

  // Resource errors (404)
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  MOVIE_NOT_FOUND: 'MOVIE_NOT_FOUND',
  SHOW_NOT_FOUND: 'SHOW_NOT_FOUND',
  EPISODE_NOT_FOUND: 'EPISODE_NOT_FOUND',
  LIBRARY_NOT_FOUND: 'LIBRARY_NOT_FOUND',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',

  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Conflict errors (409)
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',

  // Rate limiting (429)
  RATE_LIMITED: 'RATE_LIMITED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TRANSCODE_ERROR: 'TRANSCODE_ERROR',
  SCAN_ERROR: 'SCAN_ERROR',

  // Service unavailable (503)
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Maps error codes to HTTP status codes */
const errorCodeToStatusCode: Record<ErrorCodeType, number> = {
  // 401
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,

  // 403
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.FEATURE_NOT_AVAILABLE]: 403,
  [ErrorCode.LICENSE_REQUIRED]: 403,

  // 404
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.MOVIE_NOT_FOUND]: 404,
  [ErrorCode.SHOW_NOT_FOUND]: 404,
  [ErrorCode.EPISODE_NOT_FOUND]: 404,
  [ErrorCode.LIBRARY_NOT_FOUND]: 404,
  [ErrorCode.SESSION_NOT_FOUND]: 404,

  // 400
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,

  // 409
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.EMAIL_ALREADY_EXISTS]: 409,

  // 429
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,

  // 500
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 500,
  [ErrorCode.TRANSCODE_ERROR]: 500,
  [ErrorCode.SCAN_ERROR]: 500,

  // 503
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.MAINTENANCE_MODE]: 503,
};

/**
 * Base application error class.
 * Extends Error with additional context for structured error handling.
 */
export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCodeType,
    message: string,
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = errorCodeToStatusCode[code] ?? 500;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace?.(this, this.constructor);
  }

  /** Converts error to a plain object for serialization */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// Convenience error classes for common scenarios

/** 401 - Authentication required */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: Record<string, unknown>) {
    super(ErrorCode.UNAUTHORIZED, message, details);
    this.name = 'UnauthorizedError';
  }
}

/** 403 - Access forbidden */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', details?: Record<string, unknown>) {
    super(ErrorCode.FORBIDDEN, message, details);
    this.name = 'ForbiddenError';
  }
}

/** 404 - Resource not found */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string, details?: Record<string, unknown>) {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, message, { resource, id, ...details });
    this.name = 'NotFoundError';
  }
}

/** 400 - Validation failed */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

/** 409 - Resource already exists */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.CONFLICT, message, details);
    this.name = 'ConflictError';
  }
}

/** 429 - Rate limited */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message = 'Too many requests', retryAfter?: number, details?: Record<string, unknown>) {
    super(ErrorCode.RATE_LIMITED, message, { retryAfter, ...details });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/** 500 - Internal server error */
export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred', details?: Record<string, unknown>) {
    super(ErrorCode.INTERNAL_ERROR, message, details, false);
    this.name = 'InternalError';
  }
}

/** 503 - Service unavailable */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', details?: Record<string, unknown>) {
    super(ErrorCode.SERVICE_UNAVAILABLE, message, details);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Wraps unknown errors into AppError
 * @param error - Any error value
 * @param fallbackMessage - Message to use if error has no message
 */
export function toAppError(error: unknown, fallbackMessage = 'An error occurred'): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message || fallbackMessage, {
      originalError: error.name,
      stack: error.stack,
    });
  }

  return new InternalError(fallbackMessage, {
    originalError: String(error),
  });
}

