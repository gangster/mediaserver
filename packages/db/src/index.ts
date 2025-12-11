/**
 * @mediaserver/db
 *
 * Database package with Drizzle ORM schema and client.
 */

// Client
export {
  createDatabase,
  createDatabaseFromEnv,
  createTestDatabase,
} from './client.js';
export type { Database, DatabaseOptions, Schema, Client } from './client.js';

// Schema - export all tables
export * from './schema/index.js';

// Re-export drizzle-orm utilities for convenience
export { eq, ne, gt, gte, lt, lte, and, or, not, isNull, isNotNull, inArray, notInArray, like, ilike, sql, desc, asc, count, sum, avg, min, max } from 'drizzle-orm';

