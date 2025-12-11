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
  isAppError,
  toAppError,
} from './errors.js';
export type { ErrorCodeType } from './errors.js';

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

