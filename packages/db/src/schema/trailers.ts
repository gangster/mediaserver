/**
 * Trailers schema - video trailers from YouTube, Vimeo, etc.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Trailers table - stores video trailers and featurettes.
 */
export const trailers = sqliteTable('trailers', {
  id: text('id').primaryKey(),
  mediaType: text('media_type', { enum: ['movie', 'tvshow'] }).notNull(),
  mediaId: text('media_id').notNull(),
  name: text('name'),
  site: text('site').notNull(), // 'YouTube', 'Vimeo'
  videoKey: text('video_key').notNull(), // YouTube video ID
  type: text('type'), // 'Trailer', 'Teaser', 'Featurette', 'Clip'
  official: integer('official', { mode: 'boolean' }).default(true),
  publishedAt: text('published_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});


