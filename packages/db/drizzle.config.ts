import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './dist/schema/index.js',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'turso',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'file:./data/mediaserver.db',
    authToken: process.env['DATABASE_AUTH_TOKEN'],
  },
  verbose: true,
  strict: true,
});

