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
import { imagesRouter } from './routes/images.js';
import { createLogger } from './lib/logger.js';
import { initializeMetadataManager } from './services/metadata.js';
import { initializeJobQueue, shutdownJobQueue } from './jobs/index.js';

// Load environment variables
const env = loadEnv();

// Create logger
const log = createLogger(env.LOG_LEVEL);

// Run migrations before creating database connection
await runMigrationsFromEnv();

// Create database connection
const db = createDatabaseFromEnv();

// Initialize metadata manager (loads configs from DB)
await initializeMetadataManager({}, env.TMDB_API_KEY, db);
log.info('🎬 Metadata manager initialized');

// Initialize job queue with Redis/Valkey
if (env.REDIS_URL) {
  try {
    await initializeJobQueue(db, env.REDIS_URL);
    log.info(`📋 Job queue initialized with ${env.REDIS_URL}`);
  } catch (error) {
    log.warn({ error }, '⚠️  Failed to connect to Redis/Valkey - job queue disabled');
  }
} else {
  log.info('ℹ️  REDIS_URL not set - job queue disabled (jobs will run synchronously)');
}

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

// Image proxy routes
app.route('/api/images', imagesRouter);

// tRPC API
app.use(
  '/api/*',
  trpcServer({
    router: appRouter,
    endpoint: '/api',
    createContext: ({ req }) => createContext({ db, req, env }) as unknown as Record<string, unknown>,
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
log.info(`🖼️  Images API available at http://${host}:${port}/api/images`);
log.info(`💚 Health check at http://${host}:${port}/health`);

const server = serve({
  fetch: app.fetch,
  port,
  hostname: host,
});

// Graceful shutdown
async function shutdown() {
  log.info('Shutting down...');
  
  // Shutdown job queue
  try {
    await shutdownJobQueue();
  } catch {
    // Ignore errors during shutdown
  }
  
  // Close server
  server.close();
  
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Export types for client
export type { AppRouter } from './routers/app.js';
