import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration.
 * 
 * DATABASE_URL is set by the Nix flake to always point to the correct
 * database location regardless of the current working directory.
 * 
 * Always run drizzle-kit commands inside `nix develop`:
 *   nix develop -c npx drizzle-kit generate
 *   nix develop -c npx drizzle-kit migrate
 */
export default defineConfig({
  schema: './dist/schema/index.js',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'turso',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? (() => {
      throw new Error(
        'DATABASE_URL is not set. Run this command inside `nix develop`:\n' +
        '  nix develop -c npx drizzle-kit <command>'
      );
    })(),
    authToken: process.env['DATABASE_AUTH_TOKEN'],
  },
  verbose: true,
  strict: true,
});
