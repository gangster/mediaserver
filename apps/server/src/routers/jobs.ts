/**
 * Jobs router - manage background jobs via tRPC.
 */

import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from './trpc.js';
import { backgroundJobs, jobLogs, eq, desc, and, or } from '@mediaserver/db';
import { queueManager, QUEUE_NAMES, type QueueName } from '../jobs/index.js';

export const jobsRouter = router({
  /**
   * List jobs with pagination and filters.
   */
  list: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused']).optional(),
        type: z.enum(['scan', 'metadata_refresh', 'metadata_identify', 'transcode', 'thumbnail', 'cleanup']).optional(),
        queue: z.enum(['scan', 'metadata', 'transcode']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, status, type, queue } = input;
      const offset = (page - 1) * limit;

      // Build where clause
      const conditions = [];
      if (status) {
        conditions.push(eq(backgroundJobs.status, status));
      }
      if (type) {
        conditions.push(eq(backgroundJobs.type, type));
      }
      if (queue) {
        conditions.push(eq(backgroundJobs.queue, queue));
      }

      const whereClause = conditions.length > 0
        ? and(...conditions)
        : undefined;

      // Get jobs
      const jobs = await ctx.db.query.backgroundJobs.findMany({
        where: whereClause,
        orderBy: [desc(backgroundJobs.createdAt)],
        limit,
        offset,
      });

      // Get total count
      const allJobs = await ctx.db.query.backgroundJobs.findMany({
        where: whereClause,
      });
      const total = allJobs.length;

      return {
        items: jobs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Get a single job by ID.
   */
  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.query.backgroundJobs.findFirst({
        where: eq(backgroundJobs.id, input.id),
      });

      if (!job) {
        return null;
      }

      // Get logs for this job
      const logs = await ctx.db.query.jobLogs.findMany({
        where: eq(jobLogs.jobId, input.id),
        orderBy: [desc(jobLogs.timestamp)],
        limit: 100,
      });

      return {
        ...job,
        logs,
      };
    }),

  /**
   * Get active jobs (for dashboard).
   */
  active: protectedProcedure.query(async ({ ctx }) => {
    const activeJobs = await ctx.db.query.backgroundJobs.findMany({
      where: or(
        eq(backgroundJobs.status, 'active'),
        eq(backgroundJobs.status, 'waiting'),
      ),
      orderBy: [desc(backgroundJobs.createdAt)],
      limit: 10,
    });

    return activeJobs;
  }),

  /**
   * Get queue statistics.
   */
  stats: adminProcedure.query(async ({ ctx }) => {
    // Get counts by status
    const allJobs = await ctx.db.query.backgroundJobs.findMany();

    const byStatus = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    };

    const byType: Record<string, number> = {};
    const byQueue: Record<string, number> = {};

    for (const job of allJobs) {
      byStatus[job.status as keyof typeof byStatus]++;
      byType[job.type] = (byType[job.type] || 0) + 1;
      byQueue[job.queue] = (byQueue[job.queue] || 0) + 1;
    }

    // Get queue metrics
    const metrics = await ctx.db.query.queueMetrics.findMany();
    const metricsMap = Object.fromEntries(
      metrics.map((m) => [m.queue, m])
    );

    // Get live queue stats if available
    let liveStats: Record<string, { waiting: number; active: number; completed: number; failed: number; delayed: number }> = {};
    
    if (queueManager.isInitialized()) {
      for (const queueName of Object.values(QUEUE_NAMES)) {
        try {
          liveStats[queueName] = await queueManager.getQueueStats(queueName);
        } catch {
          // Queue might not exist
        }
      }
    }

    return {
      total: allJobs.length,
      byStatus,
      byType,
      byQueue,
      metrics: metricsMap,
      liveStats,
    };
  }),

  /**
   * Cancel a job.
   */
  cancel: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.query.backgroundJobs.findFirst({
        where: eq(backgroundJobs.id, input.id),
      });

      if (!job) {
        return { success: false, error: 'Job not found' };
      }

      // Only allow canceling waiting or active jobs
      if (job.status !== 'waiting' && job.status !== 'active') {
        return { success: false, error: 'Job cannot be cancelled' };
      }

      // Update status
      await ctx.db.update(backgroundJobs)
        .set({
          status: 'failed',
          error: 'Cancelled by user',
          completedAt: new Date().toISOString(),
        })
        .where(eq(backgroundJobs.id, input.id));

      // Try to remove from BullMQ queue
      if (queueManager.isInitialized() && job.queue) {
        try {
          await queueManager.removeJob(job.queue as QueueName, input.id);
        } catch {
          // Job may have already completed
        }
      }

      return { success: true };
    }),

  /**
   * Retry a failed job.
   */
  retry: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.query.backgroundJobs.findFirst({
        where: eq(backgroundJobs.id, input.id),
      });

      if (!job) {
        return { success: false, error: 'Job not found' };
      }

      // Only allow retrying failed jobs
      if (job.status !== 'failed') {
        return { success: false, error: 'Only failed jobs can be retried' };
      }

      // Update status
      await ctx.db.update(backgroundJobs)
        .set({
          status: 'waiting',
          error: null,
          completedAt: null,
          attemptsMade: (job.attemptsMade ?? 0) + 1,
        })
        .where(eq(backgroundJobs.id, input.id));

      // Try to retry in BullMQ queue
      if (queueManager.isInitialized() && job.queue) {
        try {
          await queueManager.retryJob(job.queue as QueueName, input.id);
        } catch {
          // Job may not exist in queue, that's ok
        }
      }

      return { success: true };
    }),

  /**
   * Remove a job.
   */
  remove: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.query.backgroundJobs.findFirst({
        where: eq(backgroundJobs.id, input.id),
      });

      if (!job) {
        return { success: false, error: 'Job not found' };
      }

      // Don't allow removing active jobs
      if (job.status === 'active') {
        return { success: false, error: 'Cannot remove active jobs' };
      }

      // Remove from database (logs will cascade delete)
      await ctx.db.delete(backgroundJobs)
        .where(eq(backgroundJobs.id, input.id));

      // Try to remove from BullMQ queue
      if (queueManager.isInitialized() && job.queue) {
        try {
          await queueManager.removeJob(job.queue as QueueName, input.id);
        } catch {
          // Job may not exist in queue
        }
      }

      return { success: true };
    }),

  /**
   * Clear completed jobs older than a threshold.
   */
  clearCompleted: adminProcedure
    .input(
      z.object({
        olderThanDays: z.number().min(0).default(7),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - input.olderThanDays);
      const thresholdStr = threshold.toISOString();

      // Get jobs to delete
      const jobs = await ctx.db.query.backgroundJobs.findMany({
        where: and(
          eq(backgroundJobs.status, 'completed'),
        ),
      });

      const toDelete = jobs.filter((j) => 
        j.completedAt && j.completedAt < thresholdStr
      );

      let deleted = 0;
      for (const job of toDelete) {
        await ctx.db.delete(backgroundJobs)
          .where(eq(backgroundJobs.id, job.id));
        deleted++;
      }

      return { deleted };
    }),

  /**
   * Pause a queue.
   */
  pauseQueue: adminProcedure
    .input(z.object({ queue: z.enum(['scan', 'metadata', 'transcode']) }))
    .mutation(async ({ input }) => {
      if (!queueManager.isInitialized()) {
        return { success: false, error: 'Queue system not initialized' };
      }

      await queueManager.pauseQueue(input.queue);
      return { success: true };
    }),

  /**
   * Resume a queue.
   */
  resumeQueue: adminProcedure
    .input(z.object({ queue: z.enum(['scan', 'metadata', 'transcode']) }))
    .mutation(async ({ input }) => {
      if (!queueManager.isInitialized()) {
        return { success: false, error: 'Queue system not initialized' };
      }

      await queueManager.resumeQueue(input.queue);
      return { success: true };
    }),
});
