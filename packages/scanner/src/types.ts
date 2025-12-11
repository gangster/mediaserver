/**
 * Scanner types.
 */

import type { MediaStream } from '@mediaserver/core';

/** Parsed movie filename */
export interface ParsedMovie {
  title: string;
  year?: number;
  resolution?: string;
  source?: string;
  codec?: string;
  group?: string;
}

/** Parsed TV episode filename */
export interface ParsedEpisode {
  showTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle?: string;
  year?: number;
  resolution?: string;
}

/** Media probe result */
export interface ProbeResult {
  duration: number;
  videoCodec?: string;
  audioCodec?: string;
  resolution?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  streams: MediaStream[];
  directPlayable: boolean;
  needsTranscode: boolean;
}

/** Scan result for a single item */
export interface ScanResult {
  path: string;
  type: 'movie' | 'episode';
  parsed: ParsedMovie | ParsedEpisode;
  probe?: ProbeResult;
  error?: string;
}

/** Scan progress event */
export interface ScanProgress {
  libraryId: string;
  status: 'scanning' | 'matching' | 'complete' | 'error';
  progress: number;
  currentFile?: string;
  itemsScanned: number;
  itemsTotal: number;
  newItems: number;
  updatedItems: number;
  removedItems: number;
  errors: number;
}

/** Scan options */
export interface ScanOptions {
  libraryId: string;
  paths: string[];
  type: 'movie' | 'tv';
  ignorePatterns?: string[];
  forceRescan?: boolean;
}

