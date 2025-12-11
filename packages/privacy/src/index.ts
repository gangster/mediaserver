/**
 * @mediaserver/privacy
 *
 * Privacy enforcement package - controls external connections,
 * data masking, and audit logging.
 */

// External Service Guard
export {
  ExternalServiceGuard,
  createExternalServiceGuard,
} from './guard.js';
export type {
  ExternalService,
  ExternalRequestContext,
  ExternalRequestResult,
  ExternalRequestLogEntry,
} from './guard.js';

// Data Masking
export {
  DataMasker,
  createDataMasker,
  createMaskingOptions,
  maskEmail,
  maskIpAddress,
  maskFilePath,
  maskMediaTitle,
  maskUsername,
} from './masking.js';
export type { MaskingOptions } from './masking.js';

// Audit Logging
export {
  AuditLogger,
  createAuditLogger,
} from './audit.js';
export type { CreateAuditLogInput, AuditLogCallback } from './audit.js';

