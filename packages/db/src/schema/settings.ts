/**
 * Settings and licensing schema.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Server license table - premium licensing.
 */
export const serverLicense = sqliteTable('server_license', {
  id: text('id').primaryKey().default('default'),
  tier: text('tier', { enum: ['free', 'premium'] }).notNull().default('free'),
  licenseKey: text('license_key'),
  licenseType: text('license_type', { enum: ['monthly', 'yearly', 'lifetime'] }),
  expiresAt: text('expires_at'),
  features: text('features'), // JSON array of enabled features
  activatedAt: text('activated_at'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Remote access configuration table.
 */
export const remoteAccessConfig = sqliteTable('remote_access_config', {
  id: text('id').primaryKey().default('default'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  tailscaleIp: text('tailscale_ip'),
  tailscaleHostname: text('tailscale_hostname'),
  lastConnectedAt: text('last_connected_at'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * General settings table - key-value store for runtime settings.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Metadata providers configuration.
 * Stores API keys for external metadata services.
 */
export const metadataProviders = sqliteTable('metadata_providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  apiKey: text('api_key'),
  apiSecret: text('api_secret'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(0),
  settings: text('settings'), // JSON for provider-specific settings
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

