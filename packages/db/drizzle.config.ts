import { defineConfig } from 'drizzle-kit';

/**
 * Get the default database URL.
 * Uses process.cwd() which should be the workspace root when running via yarn/nx.
 * Falls back to a path relative to the typical workspace structure.
 */
function getDefaultDbUrl(): string {
  const cwd = process.cwd();
  
  // If running from workspace root (via yarn dev, yarn db:migrate, etc.)
  if (cwd.endsWith('mediaserver')) {
    return `file:${cwd}/apps/server/data/mediaserver.db`;
  }
  
  // If running from packages/db directly
  if (cwd.endsWith('packages/db')) {
    return `file:${cwd}/../../apps/server/data/mediaserver.db`;
  }
  
  // Default fallback - assume workspace root
  return `file:${cwd}/apps/server/data/mediaserver.db`;
}

export default defineConfig({
  schema: './dist/schema/index.js',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'turso',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? getDefaultDbUrl(),
    authToken: process.env['DATABASE_AUTH_TOKEN'],
  },
  verbose: true,
  strict: true,
});

