/**
 * Database initialization script.
 *
 * Creates all tables in the database matching the Drizzle schema.
 * Run with: bun run scripts/init-db.ts
 */

import { createClient } from '@libsql/client';

const dbUrl = process.env.DATABASE_URL ?? 'file:./data/mediaserver.db';
const client = createClient({ url: dbUrl });

const statements = [
  // Users - matches packages/db/src/schema/users.ts
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'guest',
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    preferred_audio_lang TEXT DEFAULT 'en',
    preferred_subtitle_lang TEXT,
    enable_subtitles INTEGER DEFAULT 0,
    language TEXT DEFAULT 'en',
    session_timeout TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  )`,

  // Refresh tokens
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    rotated_at TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // User invitations
  `CREATE TABLE IF NOT EXISTS user_invitations (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'guest',
    invite_code TEXT NOT NULL UNIQUE,
    invited_by TEXT NOT NULL REFERENCES users(id),
    library_ids TEXT,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Libraries - matches packages/db/src/schema/libraries.ts
  `CREATE TABLE IF NOT EXISTS libraries (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    paths TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_scanned_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Settings
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Metadata providers
  `CREATE TABLE IF NOT EXISTS metadata_providers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    api_key TEXT,
    api_secret TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 0,
    settings TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Server license
  `CREATE TABLE IF NOT EXISTS server_license (
    id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
    tier TEXT NOT NULL DEFAULT 'free',
    license_key TEXT,
    license_type TEXT,
    expires_at TEXT,
    features TEXT,
    activated_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

async function main() {
  console.log('Initializing database at:', dbUrl);

  try {
    for (const stmt of statements) {
      await client.execute(stmt);
      console.log('✓ Created table');
    }

    console.log('\n✅ Database initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

main();
