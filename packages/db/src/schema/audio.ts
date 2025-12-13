/**
 * Audio tracks schema - stores audio stream metadata from media files.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Audio tracks - metadata for all audio streams in media files.
 * Parallel structure to subtitleTracks for consistency.
 */
export const audioTracks = sqliteTable('audio_tracks', {
  id: text('id').primaryKey(),
  /** Type of media this audio track belongs to */
  mediaType: text('media_type', { enum: ['movie', 'episode'] }).notNull(),
  /** ID of the movie or episode */
  mediaId: text('media_id').notNull(),
  /** FFprobe stream index */
  streamIndex: integer('stream_index').notNull(),
  /** Audio codec (aac, ac3, eac3, dts, truehd, flac, opus, etc.) */
  codec: text('codec').notNull(),
  /** Codec long name for display (e.g., "Dolby TrueHD") */
  codecLongName: text('codec_long_name'),
  /** ISO 639-2/B language code, normalized (eng, jpn, spa, etc.) */
  language: text('language'),
  /** Human-readable language name (English, Japanese, Spanish) */
  languageName: text('language_name'),
  /** Title from metadata (e.g., "English 5.1", "Director Commentary") */
  title: text('title'),
  /** Number of audio channels (2, 6, 8, etc.) */
  channels: integer('channels'),
  /** Channel layout string (stereo, 5.1, 7.1, 5.1(side), etc.) */
  channelLayout: text('channel_layout'),
  /** Sample rate in Hz (44100, 48000, etc.) */
  sampleRate: integer('sample_rate'),
  /** Bit rate in bits per second */
  bitRate: integer('bit_rate'),
  /** Bits per sample (16, 24, 32) */
  bitsPerSample: integer('bits_per_sample'),
  /** Whether this is marked as the default track in the container */
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  /** Whether this appears to be the original language track */
  isOriginal: integer('is_original', { mode: 'boolean' }).default(false),
  /** Whether this is a commentary track */
  isCommentary: integer('is_commentary', { mode: 'boolean' }).default(false),
  /** Whether this is a descriptive audio track (for visually impaired) */
  isDescriptive: integer('is_descriptive', { mode: 'boolean' }).default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

