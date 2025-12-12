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

// Genres
export {
  genres,
  movieGenres,
  showGenres,
} from './genres.js';

// Credits
export {
  people,
  movieCredits,
  showCredits,
} from './credits.js';

// Ratings
export {
  contentRatings,
} from './ratings.js';

// Trailers
export {
  trailers,
} from './trailers.js';

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
  jobLogs,
  queueMetrics,
} from './jobs.js';
export type { JobType, JobStatus } from './jobs.js';

// Settings
export {
  serverLicense,
  remoteAccessConfig,
  settings,
  metadataProviders,
} from './settings.js';

// OAuth
export {
  oauthTokens,
} from './oauth.js';

