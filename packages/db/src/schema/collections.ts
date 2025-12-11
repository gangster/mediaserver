/**
 * Collections schema.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Collections table - curated media collections.
 */
export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type', { enum: ['auto', 'manual', 'builtin'] }).notNull(),
  rules: text('rules'), // JSON array of CollectionRule for auto-collections
  sortOrder: integer('sort_order').default(0),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(true),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Collection items table - links media to collections.
 */
export const collectionItems = sqliteTable('collection_items', {
  id: text('id').primaryKey(),
  collectionId: text('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  mediaType: text('media_type', { enum: ['movie', 'tvshow'] }).notNull(),
  mediaId: text('media_id').notNull(),
  sortOrder: integer('sort_order').default(0),
  addedAt: text('added_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

