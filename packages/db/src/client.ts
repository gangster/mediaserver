/**
 * Database client setup and connection management.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema/index.js';

/** Database schema type */
export type Schema = typeof schema;

/** Database client type */
export type Database = LibSQLDatabase<Schema>;

/** Database connection options */
export interface DatabaseOptions {
  /** Database URL (file: or libsql://) */
  url: string;
  /** Auth token for Turso (optional) */
  authToken?: string;
}

/**
 * Creates a database client.
 * @param options - Connection options
 */
export function createDatabase(options: DatabaseOptions): Database {
  const client = createClient({
    url: options.url,
    authToken: options.authToken,
  });

  return drizzle(client, { schema });
}

/**
 * Creates a database client from environment variables.
 * Uses DATABASE_URL and optionally DATABASE_AUTH_TOKEN.
 */
export function createDatabaseFromEnv(): Database {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return createDatabase({
    url,
    authToken: process.env['DATABASE_AUTH_TOKEN'],
  });
}

/**
 * Creates an in-memory database for testing.
 */
export function createTestDatabase(): Database {
  const client = createClient({
    url: ':memory:',
  });

  return drizzle(client, { schema });
}

/** LibSQL client type (for direct access) */
export type { Client };

