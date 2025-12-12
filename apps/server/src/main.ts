/**
 * Server entry point.
 *
 * This is the main entry point for the mediaserver backend.
 * Uses Node.js as the runtime, Hono as the web framework, and tRPC for the API.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { trpcServer } from '@hono/trpc-server';
import { loadEnv } from '@mediaserver/config';
import { createDatabaseFromEnv, runMigrationsFromEnv } from '@mediaserver/db';
import { appRouter } from './routers/app.js';
import { createContext } from './context.js';
import { healthRouter } from './routes/health.js';
import { streamRouter } from './routes/stream.js';
import { createLogger } from './lib/logger.js';

// Load environment variables
const env = loadEnv();

// Create logger
const log = createLogger(env.LOG_LEVEL);

// Run migrations before creating database connection
await runMigrationsFromEnv();

// Create database connection
const db = createDatabaseFromEnv();

// Create Hono app
const app = new Hono();

// Global middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
      // In development, allow all origins
      if (env.NODE_ENV === 'development') {
        return origin;
      }
      // In production, you would whitelist specific origins
      return origin;
    },
    credentials: true,
  })
);

// Health check routes
app.route('/health', healthRouter);

// Streaming routes (non-tRPC for HLS)
app.route('/api/stream', streamRouter);

// tRPC API
app.use(
  '/api/*',
  trpcServer({
    router: appRouter,
    endpoint: '/api',
    createContext: ({ req }) => createContext({ db, req, env }),
  })
);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  log.error({ err }, 'Unhandled error');
  return c.json(
    {
      error: env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    },
    500
  );
});

// Start server
const port = env.PORT;
const host = env.HOST;

log.info(`🚀 Server starting on http://${host}:${port}`);
log.info(`📡 tRPC API available at http://${host}:${port}/api`);
log.info(`🎬 Streaming API available at http://${host}:${port}/api/stream`);
log.info(`💚 Health check at http://${host}:${port}/health`);

serve({
  fetch: app.fetch,
  port,
  hostname: host,
});

// Export types for client
export type { AppRouter } from './routers/app.js';
