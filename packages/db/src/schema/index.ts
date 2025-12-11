/**
 * Database schema - exports all tables for Drizzle ORM.
 */

// Users and auth
export {
  users,
  refreshTokens,
  userInvitations,
} from './users.js';

// Libraries
export {
  libraries,
  libraryPermissions,
} from './libraries.js';

// Media
export {
  movies,
  tvShows,
  seasons,
  episodes,
} from './media.js';

// Playback
export {
  watchProgress,
  playbackSessions,
  transcodeJobs,
} from './playback.js';

// Collections
export {
  collections,
  collectionItems,
} from './collections.js';

// Providers and ratings
export {
  providerConfigs,
  systemProviderDefaults,
  userProviderPreferences,
  mediaRatings,
  externalIds,
} from './providers.js';

// Privacy
export {
  privacySettings,
  analyticsEvents,
  auditLogs,
  externalRequestLogs,
  dataExportRequests,
  dataDeletionRequests,
} from './privacy.js';

// Jobs
export {
  backgroundJobs,
} from './jobs.js';

// Settings
export {
  serverLicense,
  remoteAccessConfig,
  settings,
  metadataProviders,
} from './settings.js';

