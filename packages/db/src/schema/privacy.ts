/**
 * Privacy schema - audit logs, analytics, data requests.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Privacy settings table - server-wide privacy configuration.
 */
export const privacySettings = sqliteTable('privacy_settings', {
  id: text('id').primaryKey().default('default'),
  level: text('level', { enum: ['maximum', 'private', 'balanced', 'open'] })
    .notNull()
    .default('private'),
  allowExternalConnections: integer('allow_external_connections', { mode: 'boolean' })
    .notNull()
    .default(false),
  localAnalyticsEnabled: integer('local_analytics_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  anonymousSharingEnabled: integer('anonymous_sharing_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  tmdbEnabled: integer('tmdb_enabled', { mode: 'boolean' }).notNull().default(false),
  tmdbProxyImages: integer('tmdb_proxy_images', { mode: 'boolean' }).notNull().default(true),
  opensubtitlesEnabled: integer('opensubtitles_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  maskFilePaths: integer('mask_file_paths', { mode: 'boolean' }).notNull().default(true),
  maskMediaTitles: integer('mask_media_titles', { mode: 'boolean' }).notNull().default(true),
  maskUserInfo: integer('mask_user_info', { mode: 'boolean' }).notNull().default(true),
  maskIpAddresses: integer('mask_ip_addresses', { mode: 'boolean' }).notNull().default(true),
  analyticsRetentionDays: integer('analytics_retention_days'),
  auditRetentionDays: integer('audit_retention_days'),
  externalLogRetentionDays: integer('external_log_retention_days').default(90),
  anonymousId: text('anonymous_id'),
  anonymousIdRotatedAt: text('anonymous_id_rotated_at'),
  lastAnonymousShareAt: text('last_anonymous_share_at'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Analytics events table - local analytics events.
 */
export const analyticsEvents = sqliteTable('analytics_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  sessionId: text('session_id'),
  data: text('data'), // JSON
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Audit logs table - tracks sensitive actions.
 */
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  action: text('action', {
    enum: [
      'data_access',
      'data_export',
      'data_delete',
      'external_request',
      'config_change',
      'user_create',
      'user_delete',
      'login_attempt',
      'privacy_change',
    ],
  }).notNull(),
  actor: text('actor').notNull(),
  resource: text('resource').notNull(),
  details: text('details'), // JSON
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * External request logs table - tracks external API calls.
 */
export const externalRequestLogs = sqliteTable('external_request_logs', {
  id: text('id').primaryKey(),
  service: text('service').notNull(),
  requestType: text('request_type').notNull(),
  dataSummary: text('data_summary').notNull(),
  status: text('status', { enum: ['success', 'error', 'cached'] }).notNull(),
  responseTimeMs: integer('response_time_ms'),
  cached: integer('cached', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Data export requests table - GDPR data export.
 */
export const dataExportRequests = sqliteTable('data_export_requests', {
  id: text('id').primaryKey(),
  requestedBy: text('requested_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetUserId: text('target_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed', 'expired'] })
    .notNull()
    .default('pending'),
  format: text('format', { enum: ['json', 'zip'] }).notNull().default('json'),
  filePath: text('file_path'),
  fileSize: integer('file_size'),
  errorMessage: text('error_message'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
});

/**
 * Data deletion requests table - GDPR data deletion.
 */
export const dataDeletionRequests = sqliteTable('data_deletion_requests', {
  id: text('id').primaryKey(),
  requestedBy: text('requested_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetUserId: text('target_user_id').notNull(),
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] })
    .notNull()
    .default('pending'),
  scope: text('scope', { enum: ['watch_history', 'search_history', 'all_user_data'] })
    .notNull()
    .default('all_user_data'),
  reason: text('reason'),
  itemsDeleted: integer('items_deleted'),
  errorMessage: text('error_message'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
});

