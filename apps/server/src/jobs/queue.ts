/**
 * Job queue manager using BullMQ.
 *
 * Provides centralized queue management with persistent logging.
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { nanoid } from 'nanoid';
import type { Database } from '@mediaserver/db';
import { backgroundJobs, jobLogs, queueMetrics, eq } from '@mediaserver/db';
import { createLogger } from '../lib/logger.js';
import {
  QUEUE_NAMES,
  type QueueName,
  type JobData,
  type JobProgress,
  type JobEvent,
} from './types.js';

const log = createLogger('info');

/**
 * Configuration for queue manager.
 */
export interface QueueManagerConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  };
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: QueueManagerConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
    db: 0,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
  },
};

/**
 * Job event listener type.
 */
export type JobEventListener = (event: JobEvent) => void;

/**
 * Queue manager singleton.
 */
class QueueManager {
  private connection: Redis | null = null;
  private queues: Map<QueueName, Queue> = new Map();
  private workers: Map<QueueName, Worker> = new Map();
  private queueEvents: Map<QueueName, QueueEvents> = new Map();
  private eventListeners: Set<JobEventListener> = new Set();
  private db: Database | null = null;
  private config: QueueManagerConfig = DEFAULT_CONFIG;
  private initialized = false;

  /**
   * Initialize the queue manager.
   */
  async initialize(db: Database, config?: Partial<QueueManagerConfig>): Promise<void> {
    if (this.initialized) {
      log.warn('Queue manager already initialized');
      return;
    }

    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create Redis connection
    this.connection = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      maxRetriesPerRequest: null, // Required for BullMQ
    });

    // Test connection
    try {
      await this.connection.ping();
      log.info({ redis: this.config.redis }, 'Connected to Redis');
    } catch (error) {
      log.error({ error }, 'Failed to connect to Redis');
      throw error;
    }

    // Create queues
    for (const name of Object.values(QUEUE_NAMES)) {
      this.createQueue(name);
    }

    this.initialized = true;
    log.info('Queue manager initialized');
  }

  /**
   * Create a queue and its event listeners.
   */
  private createQueue(name: QueueName): void {
    if (!this.connection) {
      throw new Error('Redis connection not established');
    }

    const queue = new Queue(name, {
      connection: this.connection.duplicate(),
      defaultJobOptions: this.config.defaultJobOptions,
    });

    const events = new QueueEvents(name, {
      connection: this.connection.duplicate(),
    });

    // Set up event handlers
    events.on('added', async ({ jobId }) => {
      await this.onJobAdded(name, jobId);
    });

    events.on('active', async ({ jobId }) => {
      await this.onJobActive(name, jobId);
    });

    events.on('progress', async ({ jobId, data }) => {
      await this.onJobProgress(name, jobId, data as JobProgress);
    });

    events.on('completed', async ({ jobId, returnvalue }) => {
      await this.onJobCompleted(name, jobId, returnvalue);
    });

    events.on('failed', async ({ jobId, failedReason }) => {
      await this.onJobFailed(name, jobId, failedReason);
    });

    this.queues.set(name, queue);
    this.queueEvents.set(name, events);
  }

  /**
   * Register a worker for a queue.
   */
  registerWorker<T extends JobData>(
    queueName: QueueName,
    processor: (job: Job<T>) => Promise<unknown>,
    concurrency = 1
  ): void {
    if (!this.connection) {
      throw new Error('Redis connection not established');
    }

    const worker = new Worker<T>(queueName, processor, {
      connection: this.connection.duplicate(),
      concurrency,
    });

    worker.on('error', (error) => {
      log.error({ queue: queueName, error }, 'Worker error');
    });

    this.workers.set(queueName, worker);
    log.info({ queue: queueName, concurrency }, 'Worker registered');
  }

  /**
   * Add a job to a queue.
   */
  async addJob<T extends JobData>(
    queueName: QueueName,
    data: T,
    options?: {
      priority?: number;
      delay?: number;
      jobId?: string;
      parentJobId?: string;
      targetName?: string;
      createdBy?: string;
    }
  ): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobId = options?.jobId ?? nanoid();

    // Create database record first
    if (this.db) {
      await this.db.insert(backgroundJobs).values({
        id: jobId,
        queue: queueName,
        type: data.type as 'scan' | 'metadata_refresh' | 'metadata_identify' | 'transcode' | 'thumbnail' | 'cleanup',
        status: 'waiting',
        priority: options?.priority ?? 0,
        targetName: options?.targetName,
        data: JSON.stringify(data),
        parentJobId: options?.parentJobId,
        createdBy: options?.createdBy,
      });
    }

    // Add to BullMQ queue
    await queue.add(data.type, data, {
      jobId,
      priority: options?.priority,
      delay: options?.delay,
    });

    return jobId;
  }

  /**
   * Get a job by ID.
   */
  async getJob(queueName: QueueName, jobId: string): Promise<Job | undefined> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return undefined;
    }
    return queue.getJob(jobId);
  }

  /**
   * Get queue stats.
   */
  async getQueueStats(queueName: QueueName): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Subscribe to job events.
   */
  subscribe(listener: JobEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit a job event to all listeners.
   */
  private emitEvent(event: JobEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        log.error({ error }, 'Error in job event listener');
      }
    }
  }

  /**
   * Handle job added event.
   */
  private async onJobAdded(queue: QueueName, jobId: string): Promise<void> {
    this.emitEvent({
      type: 'job:added',
      queue,
      jobId,
      timestamp: new Date().toISOString(),
    });

    await this.logJobEvent(jobId, 'info', 'Job added to queue');
  }

  /**
   * Handle job active event.
   */
  private async onJobActive(queue: QueueName, jobId: string): Promise<void> {
    if (this.db) {
      await this.db
        .update(backgroundJobs)
        .set({
          status: 'active',
          startedAt: new Date().toISOString(),
        })
        .where(eq(backgroundJobs.id, jobId));
    }

    this.emitEvent({
      type: 'job:active',
      queue,
      jobId,
      timestamp: new Date().toISOString(),
    });

    await this.logJobEvent(jobId, 'info', 'Job started processing');
  }

  /**
   * Handle job progress event.
   */
  private async onJobProgress(
    queue: QueueName,
    jobId: string,
    progress: JobProgress
  ): Promise<void> {
    if (this.db) {
      await this.db
        .update(backgroundJobs)
        .set({
          progress: progress.percentage,
          progressMessage: progress.message,
          processedItems: progress.processedItems,
          totalItems: progress.totalItems,
        })
        .where(eq(backgroundJobs.id, jobId));
    }

    this.emitEvent({
      type: 'job:progress',
      queue,
      jobId,
      progress,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle job completed event.
   */
  private async onJobCompleted(
    queue: QueueName,
    jobId: string,
    result: unknown
  ): Promise<void> {
    const completedAt = new Date().toISOString();

    if (this.db) {
      // Get start time to calculate duration
      const job = await this.db.query.backgroundJobs.findFirst({
        where: eq(backgroundJobs.id, jobId),
      });

      const startTime = job?.startedAt ? new Date(job.startedAt).getTime() : Date.now();
      const durationMs = Date.now() - startTime;

      await this.db
        .update(backgroundJobs)
        .set({
          status: 'completed',
          progress: 100,
          result: JSON.stringify(result),
          completedAt,
          durationMs,
        })
        .where(eq(backgroundJobs.id, jobId));

      // Update queue metrics
      await this.updateQueueMetrics(queue, 'completed', durationMs);
    }

    this.emitEvent({
      type: 'job:completed',
      queue,
      jobId,
      result,
      timestamp: completedAt,
    });

    await this.logJobEvent(jobId, 'info', 'Job completed successfully');
  }

  /**
   * Handle job failed event.
   */
  private async onJobFailed(
    queue: QueueName,
    jobId: string,
    error: string
  ): Promise<void> {
    const completedAt = new Date().toISOString();

    if (this.db) {
      const job = await this.db.query.backgroundJobs.findFirst({
        where: eq(backgroundJobs.id, jobId),
      });

      const startTime = job?.startedAt ? new Date(job.startedAt).getTime() : Date.now();
      const durationMs = Date.now() - startTime;

      await this.db
        .update(backgroundJobs)
        .set({
          status: 'failed',
          error,
          completedAt,
          durationMs,
          attemptsMade: (job?.attemptsMade ?? 0) + 1,
        })
        .where(eq(backgroundJobs.id, jobId));

      // Update queue metrics
      await this.updateQueueMetrics(queue, 'failed', durationMs);
    }

    this.emitEvent({
      type: 'job:failed',
      queue,
      jobId,
      error,
      timestamp: completedAt,
    });

    await this.logJobEvent(jobId, 'error', `Job failed: ${error}`);
  }

  /**
   * Log a job event to the database.
   */
  private async logJobEvent(
    jobId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: unknown
  ): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.insert(jobLogs).values({
        jobId,
        level,
        message,
        data: data ? JSON.stringify(data) : null,
      });
    } catch (error) {
      log.error({ error, jobId }, 'Failed to log job event');
    }
  }

  /**
   * Update queue metrics after job completion.
   */
  private async updateQueueMetrics(
    queue: QueueName,
    outcome: 'completed' | 'failed',
    durationMs: number
  ): Promise<void> {
    if (!this.db) return;

    try {
      const existing = await this.db.query.queueMetrics.findFirst({
        where: eq(queueMetrics.queue, queue),
      });

      if (existing) {
        const completedCount = existing.completedCount ?? 0;
        const failedCount = existing.failedCount ?? 0;
        const avgDuration = existing.avgDurationMs ?? 0;

        // Calculate running average
        const newCompleted = outcome === 'completed' ? completedCount + 1 : completedCount;
        const newFailed = outcome === 'failed' ? failedCount + 1 : failedCount;
        const totalJobs = newCompleted + newFailed;
        const newAvgDuration = Math.round(
          (avgDuration * (totalJobs - 1) + durationMs) / totalJobs
        );

        await this.db
          .update(queueMetrics)
          .set({
            completedCount: newCompleted,
            failedCount: newFailed,
            avgDurationMs: newAvgDuration,
            lastJobAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(queueMetrics.queue, queue));
      } else {
        await this.db.insert(queueMetrics).values({
          queue,
          completedCount: outcome === 'completed' ? 1 : 0,
          failedCount: outcome === 'failed' ? 1 : 0,
          avgDurationMs: durationMs,
          lastJobAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      log.error({ error, queue }, 'Failed to update queue metrics');
    }
  }

  /**
   * Pause a queue.
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
      log.info({ queue: queueName }, 'Queue paused');
    }
  }

  /**
   * Resume a queue.
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
      log.info({ queue: queueName }, 'Queue resumed');
    }
  }

  /**
   * Retry a failed job.
   */
  async retryJob(queueName: QueueName, jobId: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    log.info({ queue: queueName, jobId }, 'Job retry requested');
  }

  /**
   * Remove a job.
   */
  async removeJob(queueName: QueueName, jobId: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
    }

    // Also remove from database
    if (this.db) {
      await this.db.delete(backgroundJobs).where(eq(backgroundJobs.id, jobId));
    }

    this.emitEvent({
      type: 'job:removed',
      queue: queueName,
      jobId,
      timestamp: new Date().toISOString(),
    });

    log.info({ queue: queueName, jobId }, 'Job removed');
  }

  /**
   * Shutdown the queue manager.
   */
  async shutdown(): Promise<void> {
    log.info('Shutting down queue manager...');

    // Close workers
    for (const [name, worker] of this.workers) {
      await worker.close();
      log.info({ queue: name }, 'Worker closed');
    }

    // Close queue events
    for (const events of this.queueEvents.values()) {
      await events.close();
    }

    // Close queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    // Close Redis connection
    if (this.connection) {
      await this.connection.quit();
    }

    this.initialized = false;
    log.info('Queue manager shutdown complete');
  }

  /**
   * Check if the queue manager is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get a queue instance.
   */
  getQueue(name: QueueName): Queue | undefined {
    return this.queues.get(name);
  }
}

// Export singleton instance
export const queueManager = new QueueManager();
