/**
 * @mediaserver/config
 *
 * Configuration and validation schemas for the mediaserver application.
 */

// Environment
export { envSchema, loadEnv, validateEnv, isDevelopment, isProduction, isTest } from './env.js';
export type { Env } from './env.js';

// Config
export {
  configSchema,
  loadConfig,
  loadConfigSync,
  createDefaultConfig,
} from './config.js';
export type { Config, TranscodeProfile } from './config.js';

// Validation schemas
export {
  // Common
  uuidSchema,
  idSchema,
  emailSchema,
  passwordSchema,
  displayNameSchema,
  cursorSchema,
  limitSchema,
  sortDirectionSchema,
  // Auth
  loginInputSchema,
  loginFormSchema,
  registerInputSchema,
  registerFormSchema,
  refreshTokenInputSchema,
  changePasswordInputSchema,
  // User
  updateProfileInputSchema,
  userRoleSchema,
  inviteUserInputSchema,
  // Library
  libraryTypeSchema,
  createLibraryInputSchema,
  updateLibraryInputSchema,
  grantLibraryPermissionInputSchema,
  // Media
  mediaTypeSchema,
  extendedMediaTypeSchema,
  qualityProfileSchema,
  moviesListInputSchema,
  showsListInputSchema,
  searchInputSchema,
  // Playback
  createSessionInputSchema,
  updateWatchProgressInputSchema,
  sessionHeartbeatInputSchema,
  // Provider
  metadataProviderSchema,
  ratingSourceSchema,
  updateProviderConfigInputSchema,
  // Privacy
  privacyLevelSchema,
  updatePrivacySettingsInputSchema,
  dataExportRequestInputSchema,
  dataDeletionRequestInputSchema,
} from './validation.js';

// Re-export zod for convenience
export { z } from 'zod';

// Type exports
export type { LoginFormInput, RegisterFormInput } from './validation.js';

