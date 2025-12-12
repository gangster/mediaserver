/**
 * Job queue initialization.
 *
 * Sets up BullMQ queues and workers on server startup.
 */

import type { Database } from '@mediaserver/db';
import { createLogger } from '../lib/logger.js';
import { queueManager, type QueueManagerConfig } from './queue.js';
import { QUEUE_NAMES } from './types.js';
import { createScanProcessor } from './workers/scan.worker.js';
import { createMetadataProcessor } from './workers/metadata.worker.js';

const log = createLogger('info');

/**
 * Initialize the job queue system.
 *
 * @param db Database instance
 * @param redisUrl Redis connection URL (default: redis://localhost:6379)
 */
export async function initializeJobQueue(
  db: Database,
  redisUrl?: string
): Promise<typeof queueManager> {
  // Parse Redis URL
  const config = parseRedisUrl(redisUrl ?? 'redis://localhost:6379');

  try {
    // Initialize queue manager
    await queueManager.initialize(db, { redis: config });

    // Register workers
    queueManager.registerWorker(QUEUE_NAMES.SCAN, createScanProcessor(db), 1);
    queueManager.registerWorker(QUEUE_NAMES.METADATA, createMetadataProcessor(db), 2);
    // Transcode worker would be registered here when implemented

    log.info('Job queue system initialized');
    return queueManager;
  } catch (error) {
    log.error({ error }, 'Failed to initialize job queue');
    throw error;
  }
}

/**
 * Get the queue manager instance.
 */
export function getJobQueue(): typeof queueManager {
  if (!queueManager.isInitialized()) {
    throw new Error('Job queue not initialized. Call initializeJobQueue first.');
  }
  return queueManager;
}

/**
 * Parse a Redis URL into connection config.
 */
function parseRedisUrl(url: string): QueueManagerConfig['redis'] {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : 0,
    };
  } catch {
    // Default fallback
    return {
      host: 'localhost',
      port: 6379,
      db: 0,
    };
  }
}

/**
 * Gracefully shutdown the job queue.
 */
export async function shutdownJobQueue(): Promise<void> {
  if (queueManager.isInitialized()) {
    await queueManager.shutdown();
    log.info('Job queue shutdown complete');
  }
}

