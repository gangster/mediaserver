/**
 * Providers and ratings schema.
 */

import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Provider configurations table.
 */
export const providerConfigs = sqliteTable('provider_configs', {
  providerId: text('provider_id').primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  apiKey: text('api_key'),
  config: text('config'), // JSON
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * System provider defaults table.
 * 
 * Note: Primary provider fields are deprecated. The system now fetches metadata
 * from ALL configured providers and caches it. Users choose which provider's
 * metadata to display via displayMovieProvider/displayTvProvider preferences.
 */
export const systemProviderDefaults = sqliteTable('system_provider_defaults', {
  id: text('id').primaryKey().default('default'),
  /** @deprecated No longer used - metadata is fetched from all providers */
  primaryProvider: text('primary_provider').default('tmdb'),
  /** @deprecated No longer used - metadata is fetched from all providers */
  primaryMovieProvider: text('primary_movie_provider').notNull().default('tmdb'),
  /** @deprecated No longer used - metadata is fetched from all providers */
  primaryTvProvider: text('primary_tv_provider').notNull().default('tmdb'),
  /** Default provider to display for movies (metadata is cached from all) */
  displayMovieProvider: text('display_movie_provider').notNull().default('tmdb'),
  /** Default provider to display for TV shows (metadata is cached from all) */
  displayTvProvider: text('display_tv_provider').notNull().default('tmdb'),
  enabledRatingSources: text('enabled_rating_sources').notNull().default('["imdb", "rt_critics"]'),
  ratingSourceOrder: text('rating_source_order'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * User provider preferences table.
 * 
 * Allows users to override system defaults for which provider's metadata
 * to display. The actual metadata from all providers is cached in
 * provider_metadata table.
 */
export const userProviderPreferences = sqliteTable(
  'user_provider_preferences',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** @deprecated Use displayMovieProvider and displayTvProvider */
    primaryProvider: text('primary_provider'),
    /** User's preferred provider for displaying movie metadata */
    displayMovieProvider: text('display_movie_provider'),
    /** User's preferred provider for displaying TV show metadata */
    displayTvProvider: text('display_tv_provider'),
    enabledRatingSources: text('enabled_rating_sources'),
    ratingSourceOrder: text('rating_source_order'),
    traktSyncEnabled: integer('trakt_sync_enabled', { mode: 'boolean' }).default(false),
    traktAccessToken: text('trakt_access_token'),
    traktRefreshToken: text('trakt_refresh_token'),
    traktTokenExpiry: text('trakt_token_expiry'),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId] }),
  })
);

/**
 * Media ratings table - aggregated ratings from multiple sources.
 */
export const mediaRatings = sqliteTable(
  'media_ratings',
  {
    mediaType: text('media_type', { enum: ['movie', 'show'] }).notNull(),
    mediaId: text('media_id').notNull(),
    source: text('source', {
      enum: ['imdb', 'rt_critics', 'rt_audience', 'metacritic', 'letterboxd', 'trakt', 'tmdb'],
    }).notNull(),
    score: real('score').notNull(),
    scoreNormalized: real('score_normalized').notNull(),
    scoreFormatted: text('score_formatted'),
    voteCount: integer('vote_count'),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaType, table.mediaId, table.source] }),
  })
);

/**
 * External IDs table - links to external databases.
 */
export const externalIds = sqliteTable(
  'external_ids',
  {
    mediaType: text('media_type', { enum: ['movie', 'show', 'season', 'episode', 'person'] }).notNull(),
    mediaId: text('media_id').notNull(),
    provider: text('provider', { enum: ['tmdb', 'imdb', 'tvdb', 'trakt', 'anidb', 'anilist', 'mal'] }).notNull(),
    externalId: text('external_id').notNull(),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaType, table.mediaId, table.provider] }),
  })
);

