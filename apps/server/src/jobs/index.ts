/**
 * Job queue module exports.
 */

export { queueManager, type QueueManagerConfig, type JobEventListener } from './queue.js';
export {
  QUEUE_NAMES,
  type QueueName,
  type JobData,
  type JobProgress,
  type JobEvent,
  type ScanJobData,
  type MetadataJobData,
  type TranscodeJobData,
  type ScanResult,
  type MetadataResult,
} from './types.js';
export { createScanProcessor } from './workers/scan.worker.js';
export { createMetadataProcessor } from './workers/metadata.worker.js';
export { initializeJobQueue, getJobQueue, shutdownJobQueue } from './init.js';


