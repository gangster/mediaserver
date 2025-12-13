/**
 * Range Request Server
 *
 * Handles HTTP Range requests for direct play mode.
 * Implements RFC 7233 (HTTP Range Requests) with:
 * - Single range support
 * - Multi-range support (optional)
 * - Range reliability detection
 * - Automatic fallback to HLS on unreliable ranges
 *
 * @see docs/TRANSCODING_PIPELINE.md §6 for specification
 */

import { createReadStream, type ReadStream } from 'node:fs';
import { stat, open } from 'node:fs/promises';

/** Range request result */
export interface RangeResult {
  stream: ReadStream;
  start: number;
  end: number;
  total: number;
  contentLength: number;
  contentType: string;
  isPartial: boolean;
}

/** Parsed range from header */
export interface ParsedRange {
  start: number;
  end: number;
}

/** Range request statistics for reliability tracking */
export interface RangeStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  outOfOrderRequests: number;
  lastRequestTime: number;
  averageChunkSize: number;
}

/** Range reliability assessment */
export type RangeReliability = 'trusted' | 'suspect' | 'untrusted';

/**
 * Parse Range header according to RFC 7233.
 *
 * Supports:
 * - bytes=0-499 (first 500 bytes)
 * - bytes=500-999 (second 500 bytes)
 * - bytes=-500 (last 500 bytes)
 * - bytes=500- (from byte 500 to end)
 */
export function parseRangeHeader(
  rangeHeader: string,
  fileSize: number
): ParsedRange[] | null {
  if (!rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const rangeSpec = rangeHeader.slice(6);
  const ranges: ParsedRange[] = [];

  for (const part of rangeSpec.split(',')) {
    const trimmed = part.trim();
    const match = trimmed.match(/^(\d*)-(\d*)$/);

    if (!match) {
      return null; // Invalid range syntax
    }

    const startStr = match[1] ?? '';
    const endStr = match[2] ?? '';
    let start: number;
    let end: number;

    if (startStr === '' && endStr !== '') {
      // Suffix range: -500 means last 500 bytes
      const suffixLength = parseInt(endStr, 10);
      start = Math.max(0, fileSize - suffixLength);
      end = fileSize - 1;
    } else if (startStr !== '' && endStr === '') {
      // Open-ended range: 500- means from 500 to end
      start = parseInt(startStr, 10);
      end = fileSize - 1;
    } else if (startStr !== '' && endStr !== '') {
      // Explicit range: 0-499
      start = parseInt(startStr, 10);
      end = parseInt(endStr, 10);
    } else {
      return null; // Invalid: both empty
    }

    // Validate range
    if (start > end || start >= fileSize) {
      return null; // Invalid range
    }

    // Clamp end to file size
    end = Math.min(end, fileSize - 1);

    ranges.push({ start, end });
  }

  return ranges.length > 0 ? ranges : null;
}

/**
 * Get content type from file path.
 */
export function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'mkv':
      return 'video/x-matroska';
    case 'webm':
      return 'video/webm';
    case 'avi':
      return 'video/x-msvideo';
    case 'mov':
      return 'video/quicktime';
    case 'wmv':
      return 'video/x-ms-wmv';
    case 'flv':
      return 'video/x-flv';
    case 'ts':
      return 'video/MP2T';
    case 'm2ts':
    case 'mts':
      return 'video/MP2T';
    case 'mp3':
      return 'audio/mpeg';
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    case 'ogg':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Create a range response for a file.
 */
export async function createRangeResponse(
  filePath: string,
  rangeHeader?: string
): Promise<RangeResult> {
  const stats = await stat(filePath);
  const fileSize = stats.size;
  const contentType = getContentType(filePath);

  // No range header - return full file
  if (!rangeHeader) {
    return {
      stream: createReadStream(filePath),
      start: 0,
      end: fileSize - 1,
      total: fileSize,
      contentLength: fileSize,
      contentType,
      isPartial: false,
    };
  }

  // Parse range header
  const ranges = parseRangeHeader(rangeHeader, fileSize);

  if (!ranges || ranges.length === 0) {
    // Invalid range - return 416 Range Not Satisfiable
    throw new RangeNotSatisfiableError(fileSize);
  }

  // For now, only support single range
  // Multi-range (multipart/byteranges) is complex and rarely used
  const range = ranges[0];
  if (!range) {
    throw new RangeNotSatisfiableError(fileSize);
  }

  const { start, end } = range;
  const contentLength = end - start + 1;

  return {
    stream: createReadStream(filePath, { start, end }),
    start,
    end,
    total: fileSize,
    contentLength,
    contentType,
    isPartial: true,
  };
}

/**
 * Error thrown when range is not satisfiable.
 */
export class RangeNotSatisfiableError extends Error {
  readonly fileSize: number;

  constructor(fileSize: number) {
    super('Range Not Satisfiable');
    this.name = 'RangeNotSatisfiableError';
    this.fileSize = fileSize;
  }
}

/**
 * Range Request Tracker
 *
 * Tracks range request patterns to detect unreliable clients.
 * Used to decide whether to fall back to HLS.
 */
export class RangeRequestTracker {
  private stats: Map<string, RangeStats> = new Map();
  private readonly windowMs: number;
  private readonly maxOutOfOrder: number;
  private readonly minRequests: number;

  constructor(options: {
    windowMs?: number;
    maxOutOfOrder?: number;
    minRequests?: number;
  } = {}) {
    this.windowMs = options.windowMs ?? 60_000; // 1 minute window
    this.maxOutOfOrder = options.maxOutOfOrder ?? 5;
    this.minRequests = options.minRequests ?? 10;
  }

  /**
   * Record a range request.
   */
  recordRequest(
    sessionId: string,
    range: ParsedRange,
    success: boolean,
    previousEnd?: number
  ): void {
    let stats = this.stats.get(sessionId);

    if (!stats) {
      stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        outOfOrderRequests: 0,
        lastRequestTime: Date.now(),
        averageChunkSize: 0,
      };
      this.stats.set(sessionId, stats);
    }

    stats.totalRequests++;

    if (success) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
    }

    // Check for out-of-order request
    if (previousEnd !== undefined && range.start < previousEnd) {
      stats.outOfOrderRequests++;
    }

    // Update average chunk size
    const chunkSize = range.end - range.start + 1;
    stats.averageChunkSize =
      (stats.averageChunkSize * (stats.totalRequests - 1) + chunkSize) /
      stats.totalRequests;

    stats.lastRequestTime = Date.now();
  }

  /**
   * Assess range reliability for a session.
   */
  assessReliability(sessionId: string): RangeReliability {
    const stats = this.stats.get(sessionId);

    if (!stats || stats.totalRequests < this.minRequests) {
      return 'trusted'; // Not enough data
    }

    // Check failure rate
    const failureRate = stats.failedRequests / stats.totalRequests;
    if (failureRate > 0.1) {
      return 'untrusted';
    }

    // Check out-of-order rate
    const outOfOrderRate = stats.outOfOrderRequests / stats.totalRequests;
    if (outOfOrderRate > 0.2) {
      return 'suspect';
    }

    // Check for excessive out-of-order
    if (stats.outOfOrderRequests > this.maxOutOfOrder) {
      return 'suspect';
    }

    return 'trusted';
  }

  /**
   * Get stats for a session.
   */
  getStats(sessionId: string): RangeStats | undefined {
    return this.stats.get(sessionId);
  }

  /**
   * Clear stats for a session.
   */
  clearSession(sessionId: string): void {
    this.stats.delete(sessionId);
  }

  /**
   * Clean up old sessions.
   */
  cleanup(): void {
    const now = Date.now();

    for (const [sessionId, stats] of this.stats.entries()) {
      if (now - stats.lastRequestTime > this.windowMs) {
        this.stats.delete(sessionId);
      }
    }
  }
}

/**
 * Seekable Stream Server
 *
 * Provides efficient seeking in large files by:
 * - Caching file handles
 * - Pre-reading ahead of seek position
 * - Managing concurrent read operations
 */
export class SeekableStreamServer {
  private fileHandles: Map<string, { handle: Awaited<ReturnType<typeof open>>; lastAccess: number }> = new Map();
  private readonly maxHandles: number;
  private readonly handleTimeoutMs: number;

  constructor(options: {
    maxHandles?: number;
    handleTimeoutMs?: number;
  } = {}) {
    this.maxHandles = options.maxHandles ?? 100;
    this.handleTimeoutMs = options.handleTimeoutMs ?? 60_000;
  }

  /**
   * Read a range from a file efficiently.
   */
  async readRange(
    filePath: string,
    start: number,
    end: number
  ): Promise<Buffer> {
    const handle = await this.getOrOpenHandle(filePath);
    const length = end - start + 1;
    const buffer = Buffer.alloc(length);

    const { bytesRead } = await handle.handle.read(buffer, 0, length, start);

    if (bytesRead < length) {
      return buffer.subarray(0, bytesRead);
    }

    return buffer;
  }

  /**
   * Create a readable stream for a range.
   */
  createRangeStream(
    filePath: string,
    start: number,
    end: number
  ): ReadStream {
    return createReadStream(filePath, { start, end });
  }

  /**
   * Get or open a file handle.
   */
  private async getOrOpenHandle(filePath: string) {
    let entry = this.fileHandles.get(filePath);

    if (entry) {
      entry.lastAccess = Date.now();
      return entry;
    }

    // Check if we need to evict
    if (this.fileHandles.size >= this.maxHandles) {
      await this.evictOldest();
    }

    const handle = await open(filePath, 'r');
    entry = { handle, lastAccess: Date.now() };
    this.fileHandles.set(filePath, entry);

    return entry;
  }

  /**
   * Evict the oldest file handle.
   */
  private async evictOldest(): Promise<void> {
    let oldest: { path: string; lastAccess: number } | null = null;

    for (const [path, entry] of this.fileHandles.entries()) {
      if (!oldest || entry.lastAccess < oldest.lastAccess) {
        oldest = { path, lastAccess: entry.lastAccess };
      }
    }

    if (oldest) {
      const entry = this.fileHandles.get(oldest.path);
      if (entry) {
        await entry.handle.close();
        this.fileHandles.delete(oldest.path);
      }
    }
  }

  /**
   * Close a specific file handle.
   */
  async closeHandle(filePath: string): Promise<void> {
    const entry = this.fileHandles.get(filePath);
    if (entry) {
      await entry.handle.close();
      this.fileHandles.delete(filePath);
    }
  }

  /**
   * Close all file handles.
   */
  async closeAll(): Promise<void> {
    for (const entry of this.fileHandles.values()) {
      await entry.handle.close();
    }
    this.fileHandles.clear();
  }

  /**
   * Clean up expired handles.
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const toClose: string[] = [];

    for (const [path, entry] of this.fileHandles.entries()) {
      if (now - entry.lastAccess > this.handleTimeoutMs) {
        toClose.push(path);
      }
    }

    for (const path of toClose) {
      await this.closeHandle(path);
    }
  }
}

// =============================================================================
// Singleton Instances
// =============================================================================

let rangeTracker: RangeRequestTracker | null = null;
let seekableServer: SeekableStreamServer | null = null;

/**
 * Get or create the range request tracker.
 */
export function getRangeTracker(): RangeRequestTracker {
  if (!rangeTracker) {
    rangeTracker = new RangeRequestTracker();
  }
  return rangeTracker;
}

/**
 * Get or create the seekable stream server.
 */
export function getSeekableServer(): SeekableStreamServer {
  if (!seekableServer) {
    seekableServer = new SeekableStreamServer();
  }
  return seekableServer;
}

/**
 * Shutdown range server resources.
 */
export async function shutdownRangeServer(): Promise<void> {
  if (seekableServer) {
    await seekableServer.closeAll();
    seekableServer = null;
  }
  rangeTracker = null;
}
