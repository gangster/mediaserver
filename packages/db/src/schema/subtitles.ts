/**
 * Subtitles schema - subtitle track metadata.
 *
 * Note: User subtitle preferences have been moved to playback-preferences.ts
 * as part of the unified audio/subtitle preference system.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Subtitle tracks - both embedded and external sidecar files.
 */
export const subtitleTracks = sqliteTable('subtitle_tracks', {
  id: text('id').primaryKey(),
  /** Type of media this subtitle belongs to */
  mediaType: text('media_type', { enum: ['movie', 'episode'] }).notNull(),
  /** ID of the movie or episode */
  mediaId: text('media_id').notNull(),
  /** Source of the subtitle */
  source: text('source', { enum: ['embedded', 'external'] }).notNull(),
  /** Stream index for embedded subtitles */
  streamIndex: integer('stream_index'),
  /** File path for external subtitle files */
  filePath: text('file_path'),
  /** File name for external subtitle files */
  fileName: text('file_name'),
  /** Subtitle format (srt, ass, vtt, pgs, vobsub, subrip, etc.) */
  format: text('format').notNull(),
  /** ISO 639-2/B language code, normalized (eng, jpn, spa, etc.) */
  language: text('language'),
  /** Human-readable language name */
  languageName: text('language_name'),
  /** Title from metadata (e.g., "English SDH", "Commentary") */
  title: text('title'),
  /** Whether this is the default track */
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  /** Whether this is a forced subtitle (foreign dialogue only) */
  isForced: integer('is_forced', { mode: 'boolean' }).default(false),
  /** Whether this is SDH (Subtitles for Deaf/Hard of Hearing) */
  isSdh: integer('is_sdh', { mode: 'boolean' }).default(false),
  /** Whether this is closed captions */
  isCc: integer('is_cc', { mode: 'boolean' }).default(false),
  /** Codec long name for display */
  codecLongName: text('codec_long_name'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
