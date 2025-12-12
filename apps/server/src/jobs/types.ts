/**
 * Job queue types and definitions.
 */

import type { Job } from 'bullmq';

/**
 * Available queue names.
 */
export const QUEUE_NAMES = {
  SCAN: 'scan',
  METADATA: 'metadata',
  TRANSCODE: 'transcode',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Job types per queue.
 */
export type ScanJobType = 'scan_library' | 'scan_file';
export type MetadataJobType = 'refresh_movie' | 'refresh_show' | 'identify_media' | 'refresh_library';
export type TranscodeJobType = 'transcode_video' | 'generate_thumbnail';

/**
 * Scan job data.
 */
export interface ScanLibraryJobData {
  type: 'scan_library';
  libraryId: string;
  libraryName: string;
  fullScan?: boolean;
}

export interface ScanFileJobData {
  type: 'scan_file';
  filePath: string;
  libraryId: string;
}

export type ScanJobData = ScanLibraryJobData | ScanFileJobData;

/**
 * Metadata job data.
 */
export interface RefreshMovieJobData {
  type: 'refresh_movie';
  movieId: string;
  movieTitle: string;
  force?: boolean;
}

export interface RefreshShowJobData {
  type: 'refresh_show';
  showId: string;
  showTitle: string;
  force?: boolean;
}

export interface IdentifyMediaJobData {
  type: 'identify_media';
  mediaType: 'movie' | 'show';
  mediaId: string;
  externalId: string;
  provider: string;
}

export interface RefreshLibraryMetadataJobData {
  type: 'refresh_library';
  libraryId: string;
  libraryName: string;
  force?: boolean;
}

export type MetadataJobData =
  | RefreshMovieJobData
  | RefreshShowJobData
  | IdentifyMediaJobData
  | RefreshLibraryMetadataJobData;

/**
 * Transcode job data.
 */
export interface TranscodeVideoJobData {
  type: 'transcode_video';
  mediaType: 'movie' | 'episode';
  mediaId: string;
  inputPath: string;
  outputPath: string;
  preset: string;
}

export interface GenerateThumbnailJobData {
  type: 'generate_thumbnail';
  mediaType: 'movie' | 'episode';
  mediaId: string;
  inputPath: string;
  timestamp?: number;
}

export type TranscodeJobData = TranscodeVideoJobData | GenerateThumbnailJobData;

/**
 * All job data types.
 */
export type JobData = ScanJobData | MetadataJobData | TranscodeJobData;

/**
 * Job progress update payload.
 */
export interface JobProgress {
  percentage: number;
  message?: string;
  processedItems?: number;
  totalItems?: number;
}

/**
 * Job result types.
 */
export interface ScanResult {
  added: number;
  updated: number;
  removed: number;
  errors: number;
}

export interface MetadataResult {
  matched: boolean;
  title?: string;
  year?: number;
  provider?: string;
  externalId?: string;
}

export interface TranscodeResult {
  outputPath: string;
  durationMs: number;
}

/**
 * Type-safe job handler function.
 */
export type JobHandler<T extends JobData, R = unknown> = (
  job: Job<T, R>
) => Promise<R>;

/**
 * Job event types for WebSocket updates.
 */
export type JobEventType =
  | 'job:added'
  | 'job:active'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'job:removed';

export interface JobEvent {
  type: JobEventType;
  queue: QueueName;
  jobId: string;
  data?: JobData;
  progress?: JobProgress;
  result?: unknown;
  error?: string;
  timestamp: string;
}

