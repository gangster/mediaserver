/**
 * Users and authentication schema.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Users table - stores user accounts.
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'member', 'guest'] })
    .notNull()
    .default('guest'),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  preferredAudioLang: text('preferred_audio_lang').default('en'),
  preferredSubtitleLang: text('preferred_subtitle_lang'),
  enableSubtitles: integer('enable_subtitles', { mode: 'boolean' }).default(false),
  language: text('language').default('en'),
  sessionTimeout: text('session_timeout'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  lastLoginAt: text('last_login_at'),
});

/**
 * Refresh tokens table - stores JWT refresh tokens for rotation.
 */
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  familyId: text('family_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  rotatedAt: text('rotated_at'),
  revokedAt: text('revoked_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * User invitations table - pending invitations.
 */
export const userInvitations = sqliteTable('user_invitations', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  role: text('role', { enum: ['member', 'guest'] })
    .notNull()
    .default('guest'),
  inviteCode: text('invite_code').notNull().unique(),
  invitedBy: text('invited_by')
    .notNull()
    .references(() => users.id),
  libraryIds: text('library_ids'), // JSON array of library IDs
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

