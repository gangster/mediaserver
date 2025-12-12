/**
 * @mediaserver/metadata
 *
 * Metadata pipeline package with integration architecture for fetching
 * rich metadata from multiple sources (TMDB, TVDB, Fanart.tv, etc.)
 */

// Types
export * from './types.js';

// Interfaces
export * from './interfaces/index.js';

// Matcher
export {
  normalizeTitle,
  stringSimilarity,
  levenshteinDistance,
  calculateConfidence,
  scoreSearchResults,
  findBestMatch,
  extractYear,
  yearMatchScore,
  type MatcherConfig,
  DEFAULT_MATCHER_CONFIG,
} from './matcher.js';

// Manager
export {
  MetadataManager,
  createDefaultMetadataSettings,
} from './manager.js';

// Integrations
export {
  TmdbIntegration,
  TmdbClient,
  TmdbRateLimitError,
  TmdbApiError,
  type TmdbClientConfig,
  // MDBList
  MdblistIntegration,
  MdblistClient,
  type MdblistConfig,
  type MdblistMediaResponse,
  type MdblistRating,
  // TVDb
  TvdbIntegration,
  TvdbClient,
  type TvdbConfig,
  type TvdbSeries,
  type TvdbEpisode,
  type TvdbSearchResult,
  // Trakt
  TraktIntegration,
  TraktClient,
  type TraktConfig,
  type TraktUserCredentials,
  type TraktHistoryItem,
} from './integrations/index.js';

