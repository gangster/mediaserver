/**
 * Database migration utilities.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration status result.
 */
export interface MigrationStatus {
  /** Whether the database is up to date */
  isUpToDate: boolean;
  /** Whether the database file exists */
  databaseExists: boolean;
  /** Number of pending migrations */
  pending: number;
  /** Total migrations available */
  total: number;
  /** Applied migrations */
  applied: number;
}

/**
 * Ensures the database directory exists for file-based databases.
 */
function ensureDatabaseDirectory(url: string): void {
  if (url.startsWith('file:')) {
    const filePath = url.slice(5);
    const dir = path.dirname(filePath);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created database directory: ${dir}`);
    }
  }
}

/**
 * Gets the database file path from URL.
 */
function getDatabasePath(url: string): string | null {
  if (url.startsWith('file:')) {
    return url.slice(5);
  }
  return null;
}

/**
 * Finds the migrations folder.
 */
function findMigrationsFolder(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules/@mediaserver/db/drizzle'),
    path.join(process.cwd(), 'packages/db/drizzle'),
    path.join(__dirname, '../drizzle'),
    path.join(__dirname, '../../drizzle'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Checks if database migrations are up to date.
 * Does NOT run migrations, only checks status.
 */
export async function checkMigrationsStatus(): Promise<MigrationStatus> {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const dbPath = getDatabasePath(url);
  const databaseExists = dbPath ? fs.existsSync(dbPath) : true;

  const migrationsFolder = findMigrationsFolder();
  if (!migrationsFolder) {
    throw new Error('Could not find migrations folder');
  }

  // Read the journal to get available migrations
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  if (!fs.existsSync(journalPath)) {
    return {
      isUpToDate: false,
      databaseExists,
      pending: 0,
      total: 0,
      applied: 0,
    };
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
  const totalMigrations = journal.entries?.length ?? 0;

  // If database doesn't exist, all migrations are pending
  if (!databaseExists) {
    return {
      isUpToDate: totalMigrations === 0,
      databaseExists: false,
      pending: totalMigrations,
      total: totalMigrations,
      applied: 0,
    };
  }

  // Check applied migrations in the database
  try {
    const client = createClient({
      url,
      authToken: process.env['DATABASE_AUTH_TOKEN'],
    });

    // Check if __drizzle_migrations table exists and get count
    const result = await client.execute(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
    );
    
    const tableExists = (result.rows[0]?.count as number) > 0;
    
    if (!tableExists) {
      return {
        isUpToDate: totalMigrations === 0,
        databaseExists: true,
        pending: totalMigrations,
        total: totalMigrations,
        applied: 0,
      };
    }

    // Get count of applied migrations
    const appliedResult = await client.execute(
      'SELECT COUNT(*) as count FROM __drizzle_migrations'
    );
    const applied = appliedResult.rows[0]?.count as number ?? 0;
    const pending = totalMigrations - applied;

    return {
      isUpToDate: pending === 0,
      databaseExists: true,
      pending,
      total: totalMigrations,
      applied,
    };
  } catch (error) {
    // If we can't connect, assume migrations are needed
    return {
      isUpToDate: false,
      databaseExists,
      pending: totalMigrations,
      total: totalMigrations,
      applied: 0,
    };
  }
}

/**
 * Runs database migrations.
 * @param databaseUrl - Database URL
 * @param migrationsFolder - Path to migrations folder
 */
export async function runMigrations(
  databaseUrl: string,
  migrationsFolder: string
): Promise<void> {
  ensureDatabaseDirectory(databaseUrl);

  const client = createClient({
    url: databaseUrl,
    authToken: process.env['DATABASE_AUTH_TOKEN'],
  });

  const db = drizzle(client);

  console.log('🔄 Running database migrations...');
  
  await migrate(db, { migrationsFolder });
  
  console.log('✅ Database migrations completed!');
}

/**
 * Runs migrations using environment variables.
 * Looks for migrations in the standard location.
 */
export async function runMigrationsFromEnv(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const migrationsFolder = findMigrationsFolder();
  if (!migrationsFolder) {
    throw new Error(
      'Could not find migrations folder. Run from workspace root or ensure @mediaserver/db is installed.'
    );
  }

  await runMigrations(url, migrationsFolder);
}
