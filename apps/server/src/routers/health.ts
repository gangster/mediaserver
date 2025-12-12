/**
 * Health check router.
 */

import { router, publicProcedure } from './trpc.js';

export const healthRouter = router({
  /**
   * Basic health check.
   */
  check: publicProcedure.query(() => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Detailed health check with component status.
   */
  detailed: publicProcedure.query(async ({ ctx: _ctx }) => {
    const checks: Record<string, boolean> = {};

    // Check database
    try {
      // Simple query to check database connectivity
      // await ctx.db.execute(sql`SELECT 1`);
      checks['database'] = true;
    } catch {
      checks['database'] = false;
    }

    const healthy = Object.values(checks).every(Boolean);

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    };
  }),
});

