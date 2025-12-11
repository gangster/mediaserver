/**
 * Libraries schema.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Libraries table - media library configuration.
 */
export const libraries = sqliteTable('libraries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['movie', 'tv'] }).notNull(),
  paths: text('paths').notNull(), // JSON array of paths
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastScannedAt: text('last_scanned_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Library permissions table - per-user library access control.
 */
export const libraryPermissions = sqliteTable('library_permissions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id, { onDelete: 'cascade' }),
  canView: integer('can_view', { mode: 'boolean' }).notNull().default(true),
  canWatch: integer('can_watch', { mode: 'boolean' }).notNull().default(true),
  canDownload: integer('can_download', { mode: 'boolean' }).notNull().default(false),
  maxContentRating: text('max_content_rating'),
  grantedBy: text('granted_by')
    .notNull()
    .references(() => users.id),
  grantedAt: text('granted_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  expiresAt: text('expires_at'),
});

