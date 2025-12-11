/**
 * Background jobs schema.
 */

import { sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Background jobs table - tracks long-running tasks.
 */
export const backgroundJobs = sqliteTable('background_jobs', {
  id: text('id').primaryKey(),
  type: text('type', {
    enum: ['scan', 'metadata_refresh', 'transcode', 'thumbnail'],
  }).notNull(),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
  })
    .notNull()
    .default('pending'),
  targetType: text('target_type', {
    enum: ['library', 'movie', 'tvshow', 'episode'],
  }),
  targetId: text('target_id'),
  progress: real('progress').default(0),
  progressMessage: text('progress_message'),
  result: text('result'),
  error: text('error'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
});

