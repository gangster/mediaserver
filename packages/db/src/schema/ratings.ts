/**
 * Content ratings schema - age/content ratings by country.
 */

import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Content ratings table - stores content ratings (PG-13, TV-MA, etc.) by country.
 */
export const contentRatings = sqliteTable(
  'content_ratings',
  {
    mediaType: text('media_type', { enum: ['movie', 'tvshow'] }).notNull(),
    mediaId: text('media_id').notNull(),
    country: text('country').notNull(), // 'US', 'GB', etc.
    rating: text('rating').notNull(), // 'PG-13', 'TV-MA', etc.
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaType, table.mediaId, table.country] }),
  })
);

