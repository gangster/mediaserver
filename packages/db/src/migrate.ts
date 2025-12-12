/**
 * Database migration utilities.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

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

  // Find migrations folder - check common locations
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules/@mediaserver/db/drizzle'),
    path.join(process.cwd(), 'packages/db/drizzle'),
    path.join(__dirname, '../drizzle'),
    path.join(__dirname, '../../drizzle'),
  ];

  let migrationsFolder: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      migrationsFolder = p;
      break;
    }
  }

  if (!migrationsFolder) {
    throw new Error(
      `Could not find migrations folder. Searched: ${possiblePaths.join(', ')}`
    );
  }

  await runMigrations(url, migrationsFolder);
}
