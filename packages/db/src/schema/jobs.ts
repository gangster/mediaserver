/**
 * Background jobs schema.
 *
 * Supports BullMQ job queue with persistent logging and tracking.
 */

import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Job types supported by the queue system.
 */
export type JobType = 'scan' | 'metadata_refresh' | 'metadata_identify' | 'transcode' | 'thumbnail' | 'cleanup';

/**
 * Job status values.
 */
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';

/**
 * Background jobs table - tracks long-running tasks.
 * This table mirrors BullMQ job state for persistence and UI display.
 */
export const backgroundJobs = sqliteTable('background_jobs', {
  /** Primary key - matches BullMQ job ID */
  id: text('id').primaryKey(),

  /** Queue name (e.g., 'scan', 'metadata') */
  queue: text('queue').notNull().default('default'),

  /** Job type */
  type: text('type', {
    enum: ['scan', 'metadata_refresh', 'metadata_identify', 'transcode', 'thumbnail', 'cleanup'],
  }).notNull(),

  /** Current status */
  status: text('status', {
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'],
  })
    .notNull()
    .default('waiting'),

  /** Job priority (higher = more important) */
  priority: integer('priority').default(0),

  /** Target type being processed */
  targetType: text('target_type', {
    enum: ['library', 'movie', 'tvshow', 'season', 'episode'],
  }),

  /** Target ID being processed */
  targetId: text('target_id'),

  /** Human-readable target name for display */
  targetName: text('target_name'),

  /** Progress percentage (0-100) */
  progress: real('progress').default(0),

  /** Current progress message */
  progressMessage: text('progress_message'),

  /** Total items to process */
  totalItems: integer('total_items'),

  /** Items processed so far */
  processedItems: integer('processed_items').default(0),

  /** Job input data (JSON) */
  data: text('data'),

  /** Job result data (JSON) */
  result: text('result'),

  /** Error message if failed */
  error: text('error'),

  /** Error stack trace */
  stackTrace: text('stack_trace'),

  /** Number of retry attempts */
  attemptsMade: integer('attempts_made').default(0),

  /** Maximum retry attempts */
  maxAttempts: integer('max_attempts').default(3),

  /** Parent job ID (for child jobs) */
  parentJobId: text('parent_job_id'),

  /** When the job was created */
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),

  /** When the job started processing */
  startedAt: text('started_at'),

  /** When the job completed/failed */
  completedAt: text('completed_at'),

  /** Processing duration in milliseconds */
  durationMs: integer('duration_ms'),

  /** User who initiated the job */
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
});

/**
 * Job logs table - stores detailed log entries for each job.
 */
export const jobLogs = sqliteTable('job_logs', {
  /** Auto-incrementing ID */
  id: integer('id').primaryKey({ autoIncrement: true }),

  /** Reference to the job */
  jobId: text('job_id')
    .notNull()
    .references(() => backgroundJobs.id, { onDelete: 'cascade' }),

  /** Log level */
  level: text('level', {
    enum: ['debug', 'info', 'warn', 'error'],
  })
    .notNull()
    .default('info'),

  /** Log message */
  message: text('message').notNull(),

  /** Additional data (JSON) */
  data: text('data'),

  /** Timestamp */
  timestamp: text('timestamp')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Queue metrics table - stores aggregate metrics per queue.
 */
export const queueMetrics = sqliteTable('queue_metrics', {
  /** Queue name */
  queue: text('queue').primaryKey(),

  /** Total jobs completed */
  completedCount: integer('completed_count').default(0),

  /** Total jobs failed */
  failedCount: integer('failed_count').default(0),

  /** Average job duration in milliseconds */
  avgDurationMs: integer('avg_duration_ms').default(0),

  /** Last job completed timestamp */
  lastJobAt: text('last_job_at'),

  /** Last updated timestamp */
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

