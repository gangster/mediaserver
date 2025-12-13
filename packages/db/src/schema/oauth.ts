/**
 * OAuth tokens schema - stores OAuth tokens for external services (Trakt, etc.)
 */

import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * OAuth tokens table - stores user OAuth tokens for external services.
 * 
 * Each user can have one token per provider.
 */
export const oauthTokens = sqliteTable(
  'oauth_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'trakt', etc.
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    expiresAt: text('expires_at').notNull(),
    scope: text('scope'), // OAuth scope granted
    tokenType: text('token_type').default('Bearer'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    userProviderIdx: index('oauth_tokens_user_provider_idx').on(table.userId, table.provider),
  })
);

