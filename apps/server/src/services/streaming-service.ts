/**
 * Streaming Service
 *
 * Orchestrates the entire playback pipeline:
 * - Creates playback sessions with PlaybackPlan
 * - Manages transcode sessions
 * - Handles direct play vs transcode routing
 * - Provides segment and playlist access
 *
 * @see docs/TRANSCODING_PIPELINE.md for full specification
 */

import { createReadStream, type ReadStream } from 'node:fs';
import { stat, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  PlaybackPlan,
  ServerCapabilities,
  ClientCapabilities,
  MediaProbeResult,
} from '@mediaserver/core';
import { generateId } from '@mediaserver/core';
import { type Database, movies, episodes, eq } from '@mediaserver/db';
import { probeMedia } from './media-probe.js';
import {
  detectClientCapabilities,
  mergeClientCapabilities,
  detectDeviceProfile,
} from './client-capabilities.js';
import {
  createPlaybackPlan,
  type UserPlaybackPreferences,
} from './playback-planner.js';
import {
  TranscodeSession,
  TranscodeSessionManager,
  type SessionConfig,
} from './transcode-session.js';
import {
  generateMasterPlaylist,
  createMasterPlaylistFromPlan,
} from './hls-playlist.js';
import { logger } from '../lib/logger.js';
import { performStartupCleanup, killOrphanedFFmpegProcesses } from './process-cleanup.js';

/** Playback session info stored in memory */
export interface PlaybackSessionInfo {
  sessionId: string;
  userId: string;
  mediaId: string;
  mediaType: 'movie' | 'episode';
  plan: PlaybackPlan;
  probe: MediaProbeResult;
  filePath: string;
  transcodeSession?: TranscodeSession;
  createdAt: string;
  lastAccessAt: string;
  startPosition: number;
}

/** Options for creating a playback session */
export interface CreateSessionOptions {
  userId: string;
  mediaType: 'movie' | 'episode';
  mediaId: string;
  startPosition?: number;
  userAgent?: string;
  clientCapabilities?: Partial<ClientCapabilities>;
  preferredAudioLanguage?: string;
  preferredSubtitleLanguage?: string;
  audioTrackIndex?: number;
  subtitleTrackIndex?: number;
  burnSubtitles?: boolean;
}

/** Result of creating a session */
export interface CreateSessionResult {
  sessionId: string;
  plan: PlaybackPlan;
  masterPlaylistUrl: string;
  directPlay: boolean;
  startPosition: number;
  duration: number;
}

/** Segment info for streaming */
export interface SegmentInfo {
  path: string;
  size: number;
  duration: number;
  index: number;
}

/**
 * Streaming Service
 *
 * Central orchestrator for all playback operations.
 */
/** Configuration for session cleanup */
export interface StreamingServiceConfig extends Partial<SessionConfig> {
  /** Idle timeout in milliseconds before a session is cleaned up (default: 60 seconds) */
  sessionIdleTimeoutMs?: number;
  /** Interval in milliseconds between cleanup checks (default: 15 seconds) */
  cleanupIntervalMs?: number;
}

export class StreamingService {
  private sessions: Map<string, PlaybackSessionInfo> = new Map();
  private transcodeManager: TranscodeSessionManager;
  private serverCaps: ServerCapabilities;
  private db: Database;
  private sessionConfig: SessionConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private sessionIdleTimeoutMs: number;
  private cleanupIntervalMs: number;

  constructor(
    db: Database,
    serverCaps: ServerCapabilities,
    config?: StreamingServiceConfig
  ) {
    this.db = db;
    this.serverCaps = serverCaps;
    
    // Session idle timeout: 60 seconds without heartbeat = cleanup
    this.sessionIdleTimeoutMs = config?.sessionIdleTimeoutMs ?? 60_000;
    // Cleanup interval: check every 15 seconds
    this.cleanupIntervalMs = config?.cleanupIntervalMs ?? 15_000;
    
    this.sessionConfig = {
      cacheDir: '/tmp/mediaserver/transcode',
      segmentDuration: 4,
      maxSegmentsBehindPlayhead: 5,
      firstSegmentTimeoutMs: 45000, // 45 seconds - 4K transcoding can be slow
      noProgressTimeoutMs: 60000,   // 60 seconds
      ...config,
    };
    this.transcodeManager = new TranscodeSessionManager(
      serverCaps,
      this.sessionConfig
    );
    
    // Start automatic session cleanup
    this.startCleanupTimer();
    
    logger.info(
      { sessionIdleTimeoutMs: this.sessionIdleTimeoutMs, cleanupIntervalMs: this.cleanupIntervalMs },
      'StreamingService initialized with automatic session cleanup'
    );
  }
  
  /**
   * Start the automatic session cleanup timer.
   */
  private startCleanupTimer(): void {
    // Clear any existing timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await this.cleanupExpiredSessions(this.sessionIdleTimeoutMs);
        if (cleaned > 0) {
          logger.info({ cleaned, remaining: this.sessions.size }, 'Cleaned up idle sessions');
        }
      } catch (error) {
        logger.error({ error }, 'Error during session cleanup');
      }
    }, this.cleanupIntervalMs);
    
    // Don't block Node.js from exiting if this is the only timer
    this.cleanupInterval.unref();
  }
  
  /**
   * Stop the automatic session cleanup timer.
   */
  private stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Create a new playback session.
   */
  async createSession(options: CreateSessionOptions): Promise<CreateSessionResult> {
    const {
      userId,
      mediaType,
      mediaId,
      startPosition = 0,
      userAgent,
      clientCapabilities: clientCapsOverride,
      preferredAudioLanguage,
      preferredSubtitleLanguage,
      // audioTrackIndex and subtitleTrackIndex reserved for future use
      burnSubtitles,
    } = options;

    // Get media file info
    const mediaInfo = await this.getMediaInfo(mediaType, mediaId);
    if (!mediaInfo) {
      throw new Error(`Media not found: ${mediaType}/${mediaId}`);
    }

    // Probe the media file
    const probe = await probeMedia(mediaInfo.filePath);

    // Detect client capabilities
    const detectedProfile = detectDeviceProfile(userAgent ?? 'Unknown');
    const clientCaps = clientCapsOverride
      ? mergeClientCapabilities(detectedProfile, clientCapsOverride)
      : detectClientCapabilities(userAgent ?? 'Unknown');

    // Create playback plan
    const sessionId = generateId();

    const preferences: UserPlaybackPreferences = {
      preferredAudioLanguage,
      preferredSubtitleLanguage,
      burnInSubtitles: burnSubtitles ?? false,
      audioNormalization: 'off',
    };

    const plan = createPlaybackPlan({
      sessionId,
      mediaId,
      userId,
      media: probe,
      client: clientCaps,
      server: this.serverCaps,
      preferences,
      startPosition,
    });

    // Store session info
    const sessionInfo: PlaybackSessionInfo = {
      sessionId,
      userId,
      mediaId,
      mediaType,
      plan,
      probe,
      filePath: mediaInfo.filePath,
      createdAt: new Date().toISOString(),
      lastAccessAt: new Date().toISOString(),
      startPosition,
    };

    // Start transcoding if needed
    if (plan.transport === 'hls' && plan.mode !== 'direct') {
      const transcodeSession = this.transcodeManager.createSession(
        plan,
        mediaInfo.filePath
      );

      // Set up event handlers
      transcodeSession.on('segment:ready', (segment) => {
        logger.debug(
          { sessionId, segmentIndex: segment.index },
          'Segment ready'
        );
      });

      transcodeSession.on('session:error', (sid, error) => {
        logger.error({ sessionId: sid, error }, 'Transcode session error');
      });

      // Start transcoding
      await transcodeSession.start(startPosition);

      sessionInfo.transcodeSession = transcodeSession;
    }

    this.sessions.set(sessionId, sessionInfo);

    // Write master playlist to disk (so it can be served statically like FFmpeg's output)
    const sessionDir = join(this.sessionConfig.cacheDir, sessionId);
    await mkdir(sessionDir, { recursive: true });
    
    const master = createMasterPlaylistFromPlan(
      sessionId,
      mediaId,
      plan,
      `/api/stream/${sessionId}`
    );
    const masterPlaylistContent = generateMasterPlaylist(master);
    await writeFile(join(sessionDir, 'master.m3u8'), masterPlaylistContent, 'utf-8');
    
    logger.debug({ sessionId, sessionDir }, 'Written master playlist to disk');

    logger.info(
      {
        sessionId,
        mediaId,
        mode: plan.mode,
        transport: plan.transport,
      },
      'Playback session created'
    );

    return {
      sessionId,
      plan,
      masterPlaylistUrl: `/api/stream/${sessionId}/master.m3u8`,
      directPlay: plan.mode === 'direct',
      startPosition,
      duration: probe.format.duration,
    };
  }

  /**
   * Get master playlist for a session.
   */
  getMasterPlaylist(sessionId: string): string {
    logger.info({ 
      sessionId, 
      knownSessions: Array.from(this.sessions.keys()) 
    }, '[StreamingService] getMasterPlaylist called');
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.error({ 
        sessionId, 
        knownSessions: Array.from(this.sessions.keys()) 
      }, '[StreamingService] Session not found in memory');
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.lastAccessAt = new Date().toISOString();

    const master = createMasterPlaylistFromPlan(
      sessionId,
      session.mediaId,
      session.plan,
      `/api/stream/${sessionId}`
    );

    const playlistContent = generateMasterPlaylist(master);
    logger.info({ 
      sessionId, 
      plan: session.plan.mode,
      playlistContent: playlistContent.substring(0, 500),
      variantUri: master.variants[0]?.uri 
    }, '[StreamingService] Generated master playlist');
    return playlistContent;
  }

  /**
   * Get media playlist for a session.
   * Falls back to reading FFmpeg's generated playlist from disk if session is not in memory.
   */
  async getMediaPlaylist(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    
    // If session is in memory, use existing logic
    if (session) {
      session.lastAccessAt = new Date().toISOString();

      // For direct play, generate a simple playlist
      if (session.plan.mode === 'direct') {
        const playlist = this.generateDirectPlayPlaylist(session);
        logger.info({ sessionId, mode: 'direct', playlistLength: playlist.length }, '[StreamingService] getMediaPlaylist returning direct play playlist');
        return playlist;
      }

      // For transcoding, get from transcode session
      if (session.transcodeSession) {
        const playlist = session.transcodeSession.getPlaylistContent();
        const segmentCount = (playlist.match(/#EXTINF/g) || []).length;
        logger.info({ 
          sessionId, 
          mode: 'transcode', 
          segmentCount, 
          playlistPreview: playlist.substring(0, 500)
        }, '[StreamingService] getMediaPlaylist returning transcode playlist');
        return playlist;
      }

      throw new Error('No playlist available');
    }

    // Session not in memory - try to read FFmpeg's generated playlist from disk
    const playlistPath = `${this.sessionConfig.cacheDir}/${sessionId}/playlist.m3u8`;
    
    try {
      const playlistContent = await readFile(playlistPath, 'utf-8');
      
      // FFmpeg writes segment filenames as segment_00000.ts but our routes expect segment/{index}.ts
      // We need to transform the segment references
      const transformedPlaylist = playlistContent.replace(
        /segment_(\d{5})\.ts/g,
        (_, num) => `segment/${parseInt(num, 10)}.ts`
      );
      
      const segmentCount = (transformedPlaylist.match(/#EXTINF/g) || []).length;
      logger.info({ 
        sessionId, 
        mode: 'orphaned', 
        segmentCount,
        playlistPath
      }, '[StreamingService] Serving orphaned playlist from disk');
      
      return transformedPlaylist;
    } catch (error) {
      logger.warn({ sessionId, playlistPath, error }, '[StreamingService] Playlist not found on disk');
      throw new Error(`Session not found: ${sessionId}`);
    }
  }

  /**
   * Get segment file for streaming.
   * Falls back to serving from disk if session is not in memory (e.g., after server restart).
   */
  async getSegment(
    sessionId: string,
    segmentIndex: number
  ): Promise<{ stream: ReadStream; size: number; contentType: string }> {
    const session = this.sessions.get(sessionId);
    
    // If session is in memory, use existing logic
    if (session) {
      session.lastAccessAt = new Date().toISOString();

      // For direct play, serve file directly with range support
      if (session.plan.mode === 'direct') {
        throw new Error('Use range request for direct play');
      }

      // For transcoding, get segment from transcode session
      if (session.transcodeSession) {
        const segmentPath = session.transcodeSession.getSegmentPath(segmentIndex);
        const stats = await stat(segmentPath);

        return {
          stream: createReadStream(segmentPath),
          size: stats.size,
          contentType:
            session.plan.container === 'hls_fmp4'
              ? 'video/mp4'
              : 'video/MP2T',
        };
      }

      throw new Error('Segment not available');
    }

    // Session not in memory - try to serve from disk (orphaned session after restart)
    // This allows clients to continue playback after server restart
    const filename = `segment_${segmentIndex.toString().padStart(5, '0')}.ts`;
    const segmentPath = `${this.sessionConfig.cacheDir}/${sessionId}/${filename}`;
    
    try {
      const stats = await stat(segmentPath);
      logger.debug({ sessionId, segmentIndex, segmentPath }, '[StreamingService] Serving orphaned segment from disk');
      
      return {
        stream: createReadStream(segmentPath),
        size: stats.size,
        contentType: 'video/MP2T',
      };
    } catch (error) {
      logger.warn({ sessionId, segmentIndex, segmentPath, error }, '[StreamingService] Segment not found on disk');
      throw new Error(`Session not found: ${sessionId}`);
    }
  }

  /**
   * Get direct file stream for direct play mode.
   */
  async getDirectStream(
    sessionId: string,
    rangeStart?: number,
    rangeEnd?: number
  ): Promise<{
    stream: ReadStream;
    start: number;
    end: number;
    total: number;
    contentType: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.lastAccessAt = new Date().toISOString();

    const stats = await stat(session.filePath);
    const total = stats.size;

    // Parse range
    const start = rangeStart ?? 0;
    const end = rangeEnd ?? total - 1;

    const stream = createReadStream(session.filePath, { start, end });

    // Determine content type from container
    let contentType = 'video/mp4';
    if (session.filePath.endsWith('.mkv')) {
      contentType = 'video/x-matroska';
    } else if (session.filePath.endsWith('.webm')) {
      contentType = 'video/webm';
    } else if (session.filePath.endsWith('.avi')) {
      contentType = 'video/x-msvideo';
    }

    return { stream, start, end, total, contentType };
  }

  /**
   * Seek to a new position in the session.
   * For transcoding sessions, this restarts FFmpeg at the new position.
   * 
   * @param sessionId - Session ID
   * @param position - Target position in source file time (seconds)
   * @returns Seek result with new epoch info
   */
  async seek(sessionId: string, position: number): Promise<{
    success: boolean;
    epochIndex: number;
    startPosition: number;
    transcodedTime: number;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.lastAccessAt = new Date().toISOString();
    session.startPosition = position;

    let epochIndex = 0;
    let transcodedTime = position;

    if (session.transcodeSession) {
      // This will wait for the first segment to be ready
      await session.transcodeSession.seek(position, true);
      epochIndex = session.transcodeSession.getState().currentEpoch.epochIndex;
      transcodedTime = session.transcodeSession.getTranscodedTime();
    }

    logger.info(
      { sessionId, position, epochIndex, transcodedTime },
      'Seek completed'
    );

    return {
      success: true,
      epochIndex,
      startPosition: position,
      transcodedTime,
    };
  }

  /**
   * Get the current transcoded time for a session.
   * Returns how far the transcode has progressed (in source file time).
   */
  getTranscodedTime(sessionId: string): number | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.transcodeSession) {
      return session.transcodeSession.getTranscodedTime();
    }

    // For direct play, the whole file is available
    return session.probe.format.duration;
  }

  /**
   * Switch audio track in the session.
   */
  async switchAudioTrack(
    sessionId: string,
    _audioTrackIndex: number
  ): Promise<PlaybackPlan> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.lastAccessAt = new Date().toISOString();

    // TODO: Create new plan with different audio track
    // For now, this would require creating a new transcode session

    if (session.transcodeSession) {
      await session.transcodeSession.switchTrack('track_switch');
    }

    return session.plan;
  }

  /**
   * Toggle subtitles in the session.
   */
  async toggleSubtitles(
    sessionId: string,
    _enabled: boolean,
    _subtitleIndex?: number
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.lastAccessAt = new Date().toISOString();

    if (session.transcodeSession && session.plan.subtitles.mode === 'burn') {
      await session.transcodeSession.switchTrack('subtitle_toggle');
    }
  }

  /**
   * End a playback session.
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return; // Already ended
    }

    logger.info({ sessionId }, 'Ending playback session');

    // Stop transcoding
    if (session.transcodeSession) {
      await session.transcodeSession.end('session_ended');
    }

    this.sessions.delete(sessionId);
  }

  /**
   * Get session info.
   */
  getSession(sessionId: string): PlaybackSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Refresh session access timestamp (called by heartbeat).
   * Prevents the session from being cleaned up due to inactivity.
   */
  refreshSessionAccess(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Get all active sessions.
   */
  getActiveSessions(): PlaybackSessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup expired sessions.
   */
  async cleanupExpiredSessions(maxIdleMs: number = 30 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const lastAccess = new Date(session.lastAccessAt).getTime();
      if (now - lastAccess > maxIdleMs) {
        await this.endSession(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned }, 'Cleaned up expired sessions');
    }

    return cleaned;
  }

  /**
   * Shutdown all sessions and cleanup timers.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down streaming service');
    
    // Stop cleanup timer first
    this.stopCleanupTimer();
    
    // End all sessions (this will try to gracefully stop FFmpeg)
    await this.transcodeManager.endAllSessions('shutdown');
    this.sessions.clear();
    
    // Final safety check: kill any remaining FFmpeg processes for our transcode dir
    // This handles edge cases where processes might have been orphaned
    await killOrphanedFFmpegProcesses(this.sessionConfig.cacheDir);
    
    logger.info('Streaming service shutdown complete');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async getMediaInfo(
    mediaType: 'movie' | 'episode',
    mediaId: string
  ): Promise<{ filePath: string; duration: number } | null> {
    if (mediaType === 'movie') {
      const movie = await this.db.query.movies.findFirst({
        where: eq(movies.id, mediaId),
      });

      if (!movie?.filePath) return null;

      return {
        filePath: movie.filePath,
        duration: movie.duration ?? 0,
      };
    } else {
      const episode = await this.db.query.episodes.findFirst({
        where: eq(episodes.id, mediaId),
      });

      if (!episode?.filePath) return null;

      return {
        filePath: episode.filePath,
        duration: episode.duration ?? 0,
      };
    }
  }

  private generateDirectPlayPlaylist(session: PlaybackSessionInfo): string {
    // For direct play, we generate a byte-range HLS playlist
    // This allows HLS.js to fetch ranges from the file directly
    const duration = session.probe.format.duration;
    const fileSize = session.probe.fileSize ?? 0;
    const bitrate = session.probe.format.bitrate ?? 0;
    const segmentDuration = this.sessionConfig.segmentDuration;

    // If we don't have file size info, fall back to time-based estimation
    if (fileSize === 0 || bitrate === 0) {
      // Generate a simple playlist that points to the file URL
      // HLS.js will use this as a single segment
      const lines: string[] = [
        '#EXTM3U',
        '#EXT-X-VERSION:6',
        `#EXT-X-TARGETDURATION:${Math.ceil(duration)}`,
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-PLAYLIST-TYPE:VOD',
        '',
        `#EXTINF:${duration.toFixed(6)},`,
        `/api/stream/${session.sessionId}/file`,
        '#EXT-X-ENDLIST',
      ];
      return lines.join('\n') + '\n';
    }

    // Calculate byte ranges for segments based on bitrate
    const bytesPerSecond = bitrate / 8;
    const segmentCount = Math.ceil(duration / segmentDuration);

    const lines: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      `#EXT-X-TARGETDURATION:${Math.ceil(segmentDuration)}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      '',
    ];

    // Generate byte-range segment entries
    let remaining = duration;
    let byteOffset = 0;
    for (let i = 0; i < segmentCount; i++) {
      const segDuration = Math.min(segmentDuration, remaining);
      const segBytes = Math.min(
        Math.ceil(segDuration * bytesPerSecond),
        fileSize - byteOffset
      );

      lines.push(`#EXTINF:${segDuration.toFixed(6)},`);
      lines.push(`#EXT-X-BYTERANGE:${segBytes}@${byteOffset}`);
      lines.push(`/api/stream/${session.sessionId}/file`);

      byteOffset += segBytes;
      remaining -= segDuration;
    }

    lines.push('#EXT-X-ENDLIST');

    return lines.join('\n') + '\n';
  }
}

// =============================================================================
// Singleton Instance Management
// =============================================================================

let streamingServiceInstance: StreamingService | null = null;

/**
 * Initialize the streaming service singleton.
 * Performs cleanup of orphaned processes and stale directories on startup.
 */
export async function initStreamingService(
  db: Database,
  serverCaps: ServerCapabilities,
  config?: StreamingServiceConfig
): Promise<StreamingService> {
  if (streamingServiceInstance) {
    logger.warn('Streaming service already initialized, returning existing instance');
    return streamingServiceInstance;
  }

  // Clean up orphaned FFmpeg processes and stale directories from previous runs
  const transcodeDir = config?.cacheDir ?? '/tmp/mediaserver/transcode';
  await performStartupCleanup(transcodeDir);

  streamingServiceInstance = new StreamingService(db, serverCaps, config);
  return streamingServiceInstance;
}

/**
 * Get the streaming service singleton.
 */
export function getStreamingService(): StreamingService {
  if (!streamingServiceInstance) {
    throw new Error('Streaming service not initialized. Call initStreamingService first.');
  }
  return streamingServiceInstance;
}

/**
 * Shutdown the streaming service.
 */
export async function shutdownStreamingService(): Promise<void> {
  if (streamingServiceInstance) {
    await streamingServiceInstance.shutdown();
    streamingServiceInstance = null;
  }
}
