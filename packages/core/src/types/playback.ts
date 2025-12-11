/**
 * Playback-related types.
 */

import type { ISODateString, UUID } from './common.js';
import type { MediaType } from './media.js';
import type { QualityProfile } from './user.js';

/** Watch progress entity */
export interface WatchProgress {
  id: UUID;
  userId: UUID;
  mediaType: MediaType;
  mediaId: UUID;
  position: number;
  duration: number;
  percentage: number;
  isWatched: boolean;
  watchedAt?: ISODateString;
  playCount: number;
  updatedAt: ISODateString;
}

/** Watch progress update input */
export interface UpdateWatchProgressInput {
  position: number;
  duration: number;
}

/** Transcode job status */
export type TranscodeStatus = 'pending' | 'running' | 'ready' | 'error' | 'cancelled';

/** Transcode job */
export interface TranscodeJob {
  id: UUID;
  mediaType: MediaType;
  mediaId: UUID;
  profile: QualityProfile;
  status: TranscodeStatus;
  inputPath: string;
  outputDir?: string;
  playlistPath?: string;
  progress: number;
  currentSegment: number;
  error?: string;
  retryCount: number;
  createdAt: ISODateString;
  startedAt?: ISODateString;
  completedAt?: ISODateString;
  lastAccessedAt?: ISODateString;
}

/** Playback session */
export interface PlaybackSession {
  id: UUID;
  userId: UUID;
  mediaType: MediaType;
  mediaId: UUID;
  profile: QualityProfile;
  transcodeJobId?: UUID;
  playlistPath?: string;
  startPosition: number;
  lastHeartbeat?: ISODateString;
  createdAt: ISODateString;
}

/** Create session request */
export interface CreateSessionRequest {
  mediaType: MediaType;
  mediaId: UUID;
  profile?: QualityProfile;
  startPosition?: number;
}

/** Create session response */
export interface CreateSessionResponse {
  sessionId: UUID;
  masterPlaylist: string;
  profile: QualityProfile;
  directPlay: boolean;
  startPosition: number;
}

/** Session heartbeat */
export interface SessionHeartbeat {
  sessionId: UUID;
  position: number;
  isPlaying: boolean;
  buffering: boolean;
}

/** Continue watching item */
export interface ContinueWatchingItem {
  id: UUID;
  mediaType: MediaType;
  mediaId: UUID;
  title: string;
  subtitle?: string; // e.g., "S1 E3 - Episode Title"
  posterPath?: string;
  posterBlurhash?: string;
  backdropPath?: string;
  backdropBlurhash?: string;
  position: number;
  duration: number;
  percentage: number;
  updatedAt: ISODateString;
}

/** Recently added item */
export interface RecentlyAddedItem {
  id: UUID;
  mediaType: 'movie' | 'tvshow';
  title: string;
  year?: number;
  posterPath?: string;
  posterBlurhash?: string;
  addedAt: ISODateString;
}

/** Playback quality info (shown in player) */
export interface PlaybackQualityInfo {
  profile: QualityProfile;
  resolution: string;
  bitrate: number;
  codec: string;
  isDirectPlay: boolean;
  isTranscoding: boolean;
}

/** Subtitle track */
export interface SubtitleTrack {
  index: number;
  language?: string;
  title?: string;
  codec: string;
  forced: boolean;
  external: boolean;
  path?: string;
}

/** Audio track */
export interface AudioTrack {
  index: number;
  language?: string;
  title?: string;
  codec: string;
  channels: number;
  default: boolean;
}

