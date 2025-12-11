/**
 * Common types used throughout the application.
 */

/** ISO 8601 date string */
export type ISODateString = string;

/** UUID string */
export type UUID = string;

/** Pagination cursor */
export type Cursor = string;

/** Generic paginated response */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: Cursor | null;
  totalCount?: number;
}

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Generic sort configuration */
export interface SortConfig<T extends string = string> {
  field: T;
  direction: SortDirection;
}

/** Image size configuration */
export interface ImageSize {
  width: number;
  height: number;
}

/** Predefined image sizes */
export const IMAGE_SIZES = {
  poster: {
    thumbnail: { width: 92, height: 138 },
    small: { width: 154, height: 231 },
    medium: { width: 185, height: 278 },
    large: { width: 342, height: 513 },
    original: { width: 500, height: 750 },
  },
  backdrop: {
    small: { width: 300, height: 169 },
    medium: { width: 780, height: 439 },
    large: { width: 1280, height: 720 },
    original: { width: 1920, height: 1080 },
  },
  still: {
    small: { width: 185, height: 104 },
    medium: { width: 300, height: 169 },
    large: { width: 500, height: 281 },
  },
  profile: {
    small: { width: 45, height: 45 },
    medium: { width: 185, height: 185 },
    large: { width: 300, height: 300 },
  },
} as const;

/** Content rating for parental controls */
export type ContentRating =
  | 'G'
  | 'PG'
  | 'PG-13'
  | 'R'
  | 'NC-17'
  | 'TV-Y'
  | 'TV-Y7'
  | 'TV-G'
  | 'TV-PG'
  | 'TV-14'
  | 'TV-MA'
  | 'NR';

/** Job status for background tasks */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Job types */
export type JobType =
  | 'scan_library'
  | 'refresh_metadata'
  | 'transcode'
  | 'generate_thumbnails'
  | 'cleanup_transcodes'
  | 'backup_database';

/** Background job */
export interface BackgroundJob {
  id: UUID;
  type: JobType;
  status: JobStatus;
  targetType?: 'library' | 'movie' | 'tvshow' | 'episode';
  targetId?: UUID;
  progress: number;
  progressMessage?: string;
  result?: string;
  error?: string;
  createdAt: ISODateString;
  startedAt?: ISODateString;
  completedAt?: ISODateString;
  createdBy?: UUID;
}

