/**
 * Metadata provider-related types.
 */

import type { ISODateString, UUID } from './common.js';

/** Supported metadata providers */
export type MetadataProvider = 'tmdb' | 'tvdb' | 'trakt' | 'mdblist' | 'imdb';

/** Rating sources */
export type RatingSource =
  | 'imdb'
  | 'rt_critics'
  | 'rt_audience'
  | 'metacritic'
  | 'letterboxd'
  | 'trakt'
  | 'tmdb';

/** External ID providers */
export type ExternalIdProvider = 'tmdb' | 'imdb' | 'tvdb' | 'trakt';

/** Provider configuration */
export interface ProviderConfig {
  providerId: MetadataProvider;
  enabled: boolean;
  apiKey?: string;
  config?: Record<string, unknown>;
  updatedAt: ISODateString;
}

/** System provider defaults */
export interface SystemProviderDefaults {
  primaryProvider: MetadataProvider;
  enabledRatingSources: RatingSource[];
  ratingSourceOrder?: RatingSource[];
  updatedAt: ISODateString;
}

/** User provider preferences */
export interface UserProviderPreferences {
  userId: UUID;
  primaryProvider?: MetadataProvider;
  enabledRatingSources?: RatingSource[];
  ratingSourceOrder?: RatingSource[];
  traktSyncEnabled: boolean;
  traktAccessToken?: string;
  traktRefreshToken?: string;
  traktTokenExpiry?: ISODateString;
  updatedAt: ISODateString;
}

/** Media rating */
export interface MediaRating {
  mediaType: 'movie' | 'show';
  mediaId: UUID;
  source: RatingSource;
  score: number;
  scoreNormalized: number; // 0-100 scale
  scoreFormatted?: string; // e.g., "8.5/10", "85%"
  voteCount?: number;
  updatedAt: ISODateString;
}

/** External ID mapping */
export interface ExternalId {
  mediaType: 'movie' | 'show';
  mediaId: UUID;
  provider: ExternalIdProvider;
  externalId: string;
  updatedAt: ISODateString;
}

/** Metadata search result */
export interface MetadataSearchResult {
  provider: MetadataProvider;
  externalId: string;
  title: string;
  originalTitle?: string;
  year?: number;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  voteAverage?: number;
  popularity?: number;
  mediaType: 'movie' | 'tv';
  confidence?: number; // Match confidence 0-1
}

/** Metadata refresh options */
export interface MetadataRefreshOptions {
  forceRefresh?: boolean;
  includeCredits?: boolean;
  includeRatings?: boolean;
  providers?: MetadataProvider[];
}

