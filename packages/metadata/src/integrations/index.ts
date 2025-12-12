/**
 * Metadata integrations
 */

// TMDB - Primary metadata source
export { TmdbIntegration, TmdbClient, TmdbRateLimitError, TmdbApiError } from './tmdb/index.js';
export type { TmdbClientConfig } from './tmdb/index.js';

// MDBList - Aggregated ratings
export { MdblistIntegration, MdblistClient } from './mdblist/index.js';
export type { MdblistConfig, MdblistMediaResponse, MdblistRating } from './mdblist/index.js';

// TVDb - TV/anime database
export { TvdbIntegration, TvdbClient } from './tvdb/index.js';
export type { TvdbConfig, TvdbSeries, TvdbEpisode, TvdbSearchResult } from './tvdb/index.js';

// Trakt - Watch history and ratings
export { TraktIntegration, TraktClient } from './trakt/index.js';
export type { TraktConfig, TraktUserCredentials, TraktHistoryItem } from './trakt/index.js';

// Re-export types for convenience
export * from './tmdb/types.js';

