/**
 * @mediaserver/core
 *
 * Core package containing shared types, utilities, errors, and branding
 * for the mediaserver application.
 */

// Branding
export { BRANDING } from './branding.js';
export type { Branding } from './branding.js';

// Result type
export {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  mapErr,
  flatMap,
  tryCatch,
  tryCatchSync,
} from './result.js';
export type { Ok, Err, Result } from './result.js';

// Errors
export {
  ErrorCode,
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  RateLimitError,
  InternalError,
  ServiceUnavailableError,
  ExternalServiceError,
  isAppError,
  toAppError,
} from './errors.js';
export type { ErrorCodeType } from './errors.js';

// Retry utilities
export {
  withRetry,
  calculateBackoffDelay,
  isRetryableError,
  EXTERNAL_SERVICE_RETRY,
} from './retry.js';
export type { RetryConfig, RetryLogger } from './retry.js';

// Utilities
export {
  generateId,
  sleep,
  clamp,
  formatDuration,
  formatFileSize,
  formatBitrate,
  truncate,
  debounce,
  throttle,
  groupBy,
  uniqueBy,
  sortBy,
  createSortTitle,
  isDefined,
  assert,
  assertDefined,
  safeJsonParse,
  pick,
  omit,
} from './utils.js';

// Types
export * from './types/index.js';

// Config
export * from './config/index.js';

