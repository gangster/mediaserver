/**
 * Health check routes (Hono).
 *
 * These are non-tRPC routes for health checks.
 */

import { Hono } from 'hono';

export const healthRouter = new Hono();

/**
 * Basic health check.
 */
healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Liveness probe - is the process alive?
 */
healthRouter.get('/live', (c) => {
  return c.json({
    status: 'alive',
  });
});

/**
 * Readiness probe - can accept traffic?
 */
healthRouter.get('/ready', async (c) => {
  // Add checks for dependencies here (DB, etc.)
  const checks = {
    database: true, // TODO: Actual check
  };

  const healthy = Object.values(checks).every(Boolean);

  return c.json(
    {
      status: healthy ? 'ready' : 'not_ready',
      checks,
    },
    healthy ? 200 : 503
  );
});

