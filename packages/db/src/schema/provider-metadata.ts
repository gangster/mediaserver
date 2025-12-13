/**
 * Provider-specific metadata schema.
 * 
 * Stores complete metadata from each configured provider separately,
 * enabling instant switching between providers in the UI without re-fetching.
 */

import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Media type enum for provider metadata.
 */
export type ProviderMetadataMediaType = 'movie' | 'show';

/**
 * Provider enum for metadata sources.
 */
export type MetadataProvider = 'tmdb' | 'tvdb' | 'anidb' | 'anilist' | 'mal' | 'omdb' | 'trakt';

/**
 * Provider-specific metadata for movies and shows.
 * 
 * Each row represents metadata from a single provider for a single media item.
 * This allows users to switch between providers instantly since all data is pre-cached.
 */
export const providerMetadata = sqliteTable(
  'provider_metadata',
  {
    /** Media type (movie or show) */
    mediaType: text('media_type', { enum: ['movie', 'show'] }).notNull(),
    /** Internal media ID (movie.id or tvShow.id) */
    mediaId: text('media_id').notNull(),
    /** Provider that supplied this metadata */
    provider: text('provider', {
      enum: ['tmdb', 'tvdb', 'anidb', 'anilist', 'mal', 'omdb', 'trakt'],
    }).notNull(),
    
    // ===== Core metadata fields =====
    /** Title from this provider */
    title: text('title').notNull(),
    /** Original title */
    originalTitle: text('original_title'),
    /** Sort title for alphabetical ordering */
    sortTitle: text('sort_title'),
    /** Tagline/slogan */
    tagline: text('tagline'),
    /** Plot overview/description */
    overview: text('overview'),
    
    // ===== Dates =====
    /** Release date (movies) or first air date (shows) */
    releaseDate: text('release_date'),
    /** Last air date (shows only) */
    lastAirDate: text('last_air_date'),
    
    // ===== Runtime =====
    /** Runtime in minutes */
    runtime: integer('runtime'),
    
    // ===== Status (shows) =====
    /** Show status (Returning Series, Ended, etc.) */
    status: text('status'),
    
    // ===== Ratings from this provider =====
    /** Vote average (0-10) */
    voteAverage: real('vote_average'),
    /** Vote count */
    voteCount: integer('vote_count'),
    /** Popularity score */
    popularity: real('popularity'),
    
    // ===== Images =====
    /** Poster path (provider-specific URL or path) */
    posterPath: text('poster_path'),
    /** Backdrop path */
    backdropPath: text('backdrop_path'),
    /** Logo path (clearlogo) */
    logoPath: text('logo_path'),
    
    // ===== Structured data (JSON) =====
    /** Genres JSON array: ["Action", "Drama"] */
    genres: text('genres'),
    /** Content ratings JSON array: [{"country": "US", "rating": "PG-13"}] */
    contentRatings: text('content_ratings'),
    /** Networks JSON array (shows): [{"id": 1, "name": "HBO", "logoPath": "..."}] */
    networks: text('networks'),
    /** Production companies JSON array */
    productionCompanies: text('production_companies'),
    /** Trailers JSON array */
    trailers: text('trailers'),
    /** Season info JSON array (shows): [{"seasonNumber": 1, "name": "Season 1", ...}] */
    seasons: text('seasons'),
    
    // ===== Show-specific counts =====
    /** Number of seasons */
    seasonCount: integer('season_count'),
    /** Number of episodes */
    episodeCount: integer('episode_count'),
    
    // ===== Additional metadata =====
    /** Homepage URL */
    homepage: text('homepage'),
    /** Budget in USD (movies) */
    budget: integer('budget'),
    /** Revenue in USD (movies) */
    revenue: integer('revenue'),
    /** Production countries JSON array */
    productionCountries: text('production_countries'),
    /** Spoken languages JSON array */
    spokenLanguages: text('spoken_languages'),
    /** Origin country JSON array (shows) */
    originCountry: text('origin_country'),
    /** Original language */
    originalLanguage: text('original_language'),
    
    // ===== Timestamps =====
    /** When this metadata was fetched */
    fetchedAt: text('fetched_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    /** When this metadata was last updated */
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaType, table.mediaId, table.provider] }),
  })
);

/**
 * Provider-specific credits (cast and crew).
 * 
 * Stored separately per provider since cast/crew order and character names
 * may differ between sources.
 */
export const providerCredits = sqliteTable(
  'provider_credits',
  {
    /** Unique ID for this credit entry */
    id: text('id').primaryKey(),
    /** Media type (movie or show) */
    mediaType: text('media_type', { enum: ['movie', 'show'] }).notNull(),
    /** Internal media ID */
    mediaId: text('media_id').notNull(),
    /** Provider that supplied this credit */
    provider: text('provider', {
      enum: ['tmdb', 'tvdb', 'anidb', 'anilist', 'mal', 'omdb', 'trakt'],
    }).notNull(),
    /** Role type */
    roleType: text('role_type', { enum: ['cast', 'crew'] }).notNull(),
    /** Person name */
    name: text('name').notNull(),
    /** External person ID from this provider */
    externalPersonId: text('external_person_id'),
    /** Profile image path */
    profilePath: text('profile_path'),
    /** Character name (for cast) */
    character: text('character'),
    /** Department (for crew) */
    department: text('department'),
    /** Job title (for crew) */
    job: text('job'),
    /** Order in credits (for sorting) */
    creditOrder: integer('credit_order'),
  }
);

/**
 * Season metadata per provider (for shows).
 */
export const providerSeasons = sqliteTable(
  'provider_seasons',
  {
    /** Internal season ID */
    seasonId: text('season_id').notNull(),
    /** Provider that supplied this metadata */
    provider: text('provider', {
      enum: ['tmdb', 'tvdb', 'anidb', 'anilist', 'mal', 'omdb', 'trakt'],
    }).notNull(),
    /** Season number */
    seasonNumber: integer('season_number').notNull(),
    /** Season name */
    name: text('name'),
    /** Season overview */
    overview: text('overview'),
    /** Air date */
    airDate: text('air_date'),
    /** Poster path */
    posterPath: text('poster_path'),
    /** Episode count */
    episodeCount: integer('episode_count'),
    /** Vote average */
    voteAverage: real('vote_average'),
    /** When this metadata was fetched */
    fetchedAt: text('fetched_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.seasonId, table.provider] }),
  })
);

/**
 * Episode metadata per provider.
 */
export const providerEpisodes = sqliteTable(
  'provider_episodes',
  {
    /** Internal episode ID */
    episodeId: text('episode_id').notNull(),
    /** Provider that supplied this metadata */
    provider: text('provider', {
      enum: ['tmdb', 'tvdb', 'anidb', 'anilist', 'mal', 'omdb', 'trakt'],
    }).notNull(),
    /** Season number */
    seasonNumber: integer('season_number').notNull(),
    /** Episode number */
    episodeNumber: integer('episode_number').notNull(),
    /** Episode title */
    title: text('title'),
    /** Episode overview */
    overview: text('overview'),
    /** Air date */
    airDate: text('air_date'),
    /** Runtime in minutes */
    runtime: integer('runtime'),
    /** Still image path */
    stillPath: text('still_path'),
    /** Vote average */
    voteAverage: real('vote_average'),
    /** Vote count */
    voteCount: integer('vote_count'),
    /** Guest stars JSON array */
    guestStars: text('guest_stars'),
    /** Crew JSON array */
    crew: text('crew'),
    /** When this metadata was fetched */
    fetchedAt: text('fetched_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.episodeId, table.provider] }),
  })
);

