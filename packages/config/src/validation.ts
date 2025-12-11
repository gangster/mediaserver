/**
 * Zod validation schemas for API inputs.
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

/** UUID schema */
export const uuidSchema = z.string().uuid();

/** Email schema */
export const emailSchema = z.string().email().toLowerCase().trim();

/** Password schema - minimum 8 characters */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

/** Display name schema */
export const displayNameSchema = z
  .string()
  .min(1, 'Display name is required')
  .max(100, 'Display name must be at most 100 characters')
  .trim();

/** Pagination cursor */
export const cursorSchema = z.string().optional();

/** Pagination limit */
export const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

/** Sort direction */
export const sortDirectionSchema = z.enum(['asc', 'desc']).default('asc');

// ============================================================================
// Auth Schemas
// ============================================================================

/** Login input */
export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/** Login form schema (same as API for login) */
export const loginFormSchema = loginInputSchema;
export type LoginFormInput = z.infer<typeof loginFormSchema>;

/** Registration input (API) */
export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  inviteCode: z.string().optional(),
});

/** Registration form schema (frontend - includes confirmPassword) */
export const registerFormSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    displayName: displayNameSchema,
    inviteCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterFormInput = z.infer<typeof registerFormSchema>;

/** Refresh token input */
export const refreshTokenInputSchema = z.object({
  refreshToken: z.string().min(1),
});

/** Change password input */
export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

// ============================================================================
// User Schemas
// ============================================================================

/** Update profile input */
export const updateProfileInputSchema = z.object({
  displayName: displayNameSchema.optional(),
  avatarUrl: z.string().url().optional().nullable(),
  preferredAudioLang: z.string().length(2).optional(),
  preferredSubtitleLang: z.string().length(2).optional().nullable(),
  enableSubtitles: z.boolean().optional(),
  language: z.string().length(2).optional(),
});

/** User role schema */
export const userRoleSchema = z.enum(['owner', 'admin', 'member', 'guest']);

/** User invitation input */
export const inviteUserInputSchema = z.object({
  email: emailSchema,
  role: z.enum(['member', 'guest']).default('guest'),
  libraryIds: z.array(uuidSchema).optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

// ============================================================================
// Library Schemas
// ============================================================================

/** Library type schema */
export const libraryTypeSchema = z.enum(['movie', 'tv']);

/** Create library input */
export const createLibraryInputSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  type: libraryTypeSchema,
  paths: z.array(z.string().min(1)).min(1, 'At least one path is required'),
  enabled: z.boolean().default(true),
});

/** Update library input */
export const updateLibraryInputSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  paths: z.array(z.string().min(1)).min(1).optional(),
  enabled: z.boolean().optional(),
});

/** Grant library permission input */
export const grantLibraryPermissionInputSchema = z.object({
  userId: uuidSchema,
  libraryId: uuidSchema,
  canView: z.boolean().default(true),
  canWatch: z.boolean().default(true),
  canDownload: z.boolean().default(false),
  maxContentRating: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

// ============================================================================
// Media Schemas
// ============================================================================

/** Media type schema */
export const mediaTypeSchema = z.enum(['movie', 'episode']);

/** Extended media type schema */
export const extendedMediaTypeSchema = z.enum(['movie', 'tvshow', 'episode']);

/** Quality profile schema */
export const qualityProfileSchema = z.enum(['original', '4k', '1080p', '720p', '480p']);

/** Movies list input */
export const moviesListInputSchema = z.object({
  libraryId: uuidSchema.optional(),
  genre: z.string().optional(),
  year: z.number().int().min(1888).max(2100).optional(),
  sort: z.enum(['addedAt', 'title', 'year', 'rating']).default('addedAt'),
  direction: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

/** TV shows list input */
export const showsListInputSchema = z.object({
  libraryId: uuidSchema.optional(),
  genre: z.string().optional(),
  status: z.string().optional(),
  sort: z.enum(['addedAt', 'title', 'year', 'rating']).default('addedAt'),
  direction: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

/** Search input */
export const searchInputSchema = z.object({
  query: z.string().min(1).max(200).trim(),
  type: extendedMediaTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ============================================================================
// Playback Schemas
// ============================================================================

/** Create session input */
export const createSessionInputSchema = z.object({
  mediaType: mediaTypeSchema,
  mediaId: uuidSchema,
  profile: qualityProfileSchema.optional(),
  startPosition: z.number().int().min(0).optional(),
});

/** Update watch progress input */
export const updateWatchProgressInputSchema = z.object({
  mediaType: mediaTypeSchema,
  mediaId: uuidSchema,
  position: z.number().int().min(0),
  duration: z.number().int().min(0),
});

/** Session heartbeat input */
export const sessionHeartbeatInputSchema = z.object({
  sessionId: uuidSchema,
  position: z.number().int().min(0),
  isPlaying: z.boolean(),
  buffering: z.boolean().default(false),
});

// ============================================================================
// Provider Schemas
// ============================================================================

/** Metadata provider schema */
export const metadataProviderSchema = z.enum(['tmdb', 'tvdb', 'trakt', 'mdblist', 'imdb']);

/** Rating source schema */
export const ratingSourceSchema = z.enum([
  'imdb',
  'rt_critics',
  'rt_audience',
  'metacritic',
  'letterboxd',
  'trakt',
  'tmdb',
]);

/** Update provider config input */
export const updateProviderConfigInputSchema = z.object({
  providerId: metadataProviderSchema,
  enabled: z.boolean().optional(),
  apiKey: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

// ============================================================================
// Privacy Schemas
// ============================================================================

/** Privacy level schema */
export const privacyLevelSchema = z.enum(['maximum', 'private', 'balanced', 'open']);

/** Update privacy settings input */
export const updatePrivacySettingsInputSchema = z.object({
  level: privacyLevelSchema.optional(),
  allowExternalConnections: z.boolean().optional(),
  localAnalyticsEnabled: z.boolean().optional(),
  anonymousSharingEnabled: z.boolean().optional(),
  tmdbEnabled: z.boolean().optional(),
  tmdbProxyImages: z.boolean().optional(),
  opensubtitlesEnabled: z.boolean().optional(),
  maskFilePaths: z.boolean().optional(),
  maskMediaTitles: z.boolean().optional(),
  maskUserInfo: z.boolean().optional(),
  maskIpAddresses: z.boolean().optional(),
  analyticsRetentionDays: z.number().int().min(1).max(365).optional(),
  auditRetentionDays: z.number().int().min(1).max(365).optional(),
  externalLogRetentionDays: z.number().int().min(1).max(365).optional(),
});

/** Data export request input */
export const dataExportRequestInputSchema = z.object({
  targetUserId: uuidSchema.optional(), // Admin can export other users' data
  format: z.enum(['json', 'zip']).default('json'),
});

/** Data deletion request input */
export const dataDeletionRequestInputSchema = z.object({
  targetUserId: uuidSchema.optional(), // Admin can delete other users' data
  scope: z.enum(['watch_history', 'search_history', 'all_user_data']),
  reason: z.string().max(500).optional(),
});

