/**
 * Media schema - movies, TV shows, seasons, episodes.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { libraries } from './libraries.js';

/**
 * Movies table.
 */
export const movies = sqliteTable('movies', {
  id: text('id').primaryKey(),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull().unique(),
  title: text('title').notNull(),
  sortTitle: text('sort_title'),
  year: integer('year'),
  tmdbId: integer('tmdb_id'),
  imdbId: text('imdb_id'),
  overview: text('overview'),
  tagline: text('tagline'),
  releaseDate: text('release_date'),
  runtime: integer('runtime'),
  contentRating: text('content_rating'),
  voteAverage: real('vote_average'),
  voteCount: integer('vote_count'),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  posterBlurhash: text('poster_blurhash'),
  backdropBlurhash: text('backdrop_blurhash'),
  genres: text('genres'), // JSON array
  duration: integer('duration'),
  videoCodec: text('video_codec'),
  audioCodec: text('audio_codec'),
  resolution: text('resolution'),
  mediaStreams: text('media_streams'), // JSON array of MediaStream
  directPlayable: integer('direct_playable', { mode: 'boolean' }).default(false),
  needsTranscode: integer('needs_transcode', { mode: 'boolean' }).default(false),
  subtitlePaths: text('subtitle_paths'), // JSON array
  matchStatus: text('match_status', {
    enum: ['pending', 'matched', 'unmatched', 'manual'],
  })
    .notNull()
    .default('pending'),
  addedAt: text('added_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * TV Shows table.
 */
export const tvShows = sqliteTable('tv_shows', {
  id: text('id').primaryKey(),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id, { onDelete: 'cascade' }),
  folderPath: text('folder_path').notNull().unique(),
  title: text('title').notNull(),
  sortTitle: text('sort_title'),
  year: integer('year'),
  tmdbId: integer('tmdb_id'),
  imdbId: text('imdb_id'),
  overview: text('overview'),
  firstAirDate: text('first_air_date'),
  lastAirDate: text('last_air_date'),
  status: text('status'),
  network: text('network'),
  networkLogoPath: text('network_logo_path'),
  contentRating: text('content_rating'),
  voteAverage: real('vote_average'),
  voteCount: integer('vote_count'),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  posterBlurhash: text('poster_blurhash'),
  backdropBlurhash: text('backdrop_blurhash'),
  genres: text('genres'), // JSON array
  seasonCount: integer('season_count').notNull().default(0),
  episodeCount: integer('episode_count').notNull().default(0),
  matchStatus: text('match_status', {
    enum: ['pending', 'matched', 'unmatched', 'manual'],
  })
    .notNull()
    .default('pending'),
  addedAt: text('added_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Seasons table.
 */
export const seasons = sqliteTable('seasons', {
  id: text('id').primaryKey(),
  showId: text('show_id')
    .notNull()
    .references(() => tvShows.id, { onDelete: 'cascade' }),
  seasonNumber: integer('season_number').notNull(),
  tmdbId: integer('tmdb_id'),
  name: text('name'),
  overview: text('overview'),
  airDate: text('air_date'),
  posterPath: text('poster_path'),
  posterBlurhash: text('poster_blurhash'),
  episodeCount: integer('episode_count').notNull().default(0),
  addedAt: text('added_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Episodes table.
 */
export const episodes = sqliteTable('episodes', {
  id: text('id').primaryKey(),
  showId: text('show_id')
    .notNull()
    .references(() => tvShows.id, { onDelete: 'cascade' }),
  seasonId: text('season_id')
    .notNull()
    .references(() => seasons.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull().unique(),
  seasonNumber: integer('season_number').notNull(),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title'),
  tmdbId: integer('tmdb_id'),
  overview: text('overview'),
  airDate: text('air_date'),
  runtime: integer('runtime'),
  stillPath: text('still_path'),
  stillBlurhash: text('still_blurhash'),
  voteAverage: real('vote_average'),
  duration: integer('duration'),
  videoCodec: text('video_codec'),
  audioCodec: text('audio_codec'),
  resolution: text('resolution'),
  mediaStreams: text('media_streams'), // JSON array of MediaStream
  directPlayable: integer('direct_playable', { mode: 'boolean' }).default(false),
  needsTranscode: integer('needs_transcode', { mode: 'boolean' }).default(false),
  subtitlePaths: text('subtitle_paths'), // JSON array
  addedAt: text('added_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

