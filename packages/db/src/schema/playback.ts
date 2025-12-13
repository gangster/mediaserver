/**
 * Playback schema - watch progress, sessions, transcoding.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Watch progress table - tracks user's watch progress.
 */
export const watchProgress = sqliteTable('watch_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  mediaType: text('media_type', { enum: ['movie', 'episode'] }).notNull(),
  mediaId: text('media_id').notNull(),
  /** User's preferred version ID (for movies/episodes with multiple file versions) */
  preferredVersionId: text('preferred_version_id'),
  position: integer('position').notNull().default(0),
  duration: integer('duration').notNull().default(0),
  percentage: real('percentage').notNull().default(0),
  isWatched: integer('is_watched', { mode: 'boolean' }).notNull().default(false),
  watchedAt: text('watched_at'),
  playCount: integer('play_count').notNull().default(0),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Playback sessions table - active streaming sessions.
 */
export const playbackSessions = sqliteTable('playback_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  mediaType: text('media_type', { enum: ['movie', 'episode'] }).notNull(),
  mediaId: text('media_id').notNull(),
  profile: text('profile', { enum: ['original', '4k', '1080p', '720p', '480p'] }).notNull(),
  transcodeJobId: text('transcode_job_id'),
  playlistPath: text('playlist_path'),
  startPosition: integer('start_position').default(0),
  lastHeartbeat: text('last_heartbeat'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Transcode jobs table - video transcoding jobs.
 */
export const transcodeJobs = sqliteTable('transcode_jobs', {
  id: text('id').primaryKey(),
  mediaType: text('media_type', { enum: ['movie', 'episode'] }).notNull(),
  mediaId: text('media_id').notNull(),
  profile: text('profile', { enum: ['original', '4k', '1080p', '720p', '480p'] }).notNull(),
  status: text('status', { enum: ['pending', 'running', 'ready', 'error', 'cancelled'] })
    .notNull()
    .default('pending'),
  inputPath: text('input_path').notNull(),
  outputDir: text('output_dir'),
  playlistPath: text('playlist_path'),
  progress: real('progress').default(0),
  currentSegment: integer('current_segment').default(0),
  error: text('error'),
  retryCount: integer('retry_count').default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  lastAccessedAt: text('last_accessed_at'),
});

