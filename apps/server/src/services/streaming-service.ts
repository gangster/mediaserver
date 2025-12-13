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
import { stat } from 'node:fs/promises';
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
export class StreamingService {
  private sessions: Map<string, PlaybackSessionInfo> = new Map();
  private transcodeManager: TranscodeSessionManager;
  private serverCaps: ServerCapabilities;
  private db: Database;
  private sessionConfig: SessionConfig;

  constructor(
    db: Database,
    serverCaps: ServerCapabilities,
    config?: Partial<SessionConfig>
  ) {
    this.db = db;
    this.serverCaps = serverCaps;
    this.sessionConfig = {
      cacheDir: '/tmp/mediaserver/transcode',
      segmentDuration: 4,
      maxSegmentsBehindPlayhead: 5,
      firstSegmentTimeoutMs: 15000,
      noProgressTimeoutMs: 30000,
      ...config,
    };
    this.transcodeManager = new TranscodeSessionManager(
      serverCaps,
      this.sessionConfig
    );
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
    };
  }

  /**
   * Get master playlist for a session.
   */
  getMasterPlaylist(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.lastAccessAt = new Date().toISOString();

    const master = createMasterPlaylistFromPlan(
      sessionId,
      session.mediaId,
      session.plan,
      `/api/stream/${sessionId}`
    );

    return generateMasterPlaylist(master);
  }

  /**
   * Get media playlist for a session.
   */
  getMediaPlaylist(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.lastAccessAt = new Date().toISOString();

    // For direct play, generate a simple playlist
    if (session.plan.mode === 'direct') {
      return this.generateDirectPlayPlaylist(session);
    }

    // For transcoding, get from transcode session
    if (session.transcodeSession) {
      return session.transcodeSession.getPlaylistContent();
    }

    throw new Error('No playlist available');
  }

  /**
   * Get segment file for streaming.
   */
  async getSegment(
    sessionId: string,
    segmentIndex: number
  ): Promise<{ stream: ReadStream; size: number; contentType: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

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
   */
  async seek(sessionId: string, position: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.lastAccessAt = new Date().toISOString();
    session.startPosition = position;

    if (session.transcodeSession) {
      await session.transcodeSession.seek(position);
    }
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
   * Shutdown all sessions.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down streaming service');
    await this.transcodeManager.endAllSessions('shutdown');
    this.sessions.clear();
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
    // For direct play, we generate a simple single-file playlist
    // The client will use range requests for actual playback
    const duration = session.probe.format.duration;
    const segmentDuration = this.sessionConfig.segmentDuration;
    const segmentCount = Math.ceil(duration / segmentDuration);

    const lines: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      `#EXT-X-TARGETDURATION:${Math.ceil(segmentDuration)}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      '',
      // Direct file URL for range-based playback
      `#EXT-X-MAP:URI="/api/stream/${session.sessionId}/file"`,
      '',
    ];

    // Generate segment entries
    let remaining = duration;
    for (let i = 0; i < segmentCount; i++) {
      const segDuration = Math.min(segmentDuration, remaining);
      lines.push(`#EXTINF:${segDuration.toFixed(6)},`);
      lines.push(`/api/stream/${session.sessionId}/segment/${i}.ts`);
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
 */
export function initStreamingService(
  db: Database,
  serverCaps: ServerCapabilities,
  config?: Partial<SessionConfig>
): StreamingService {
  if (streamingServiceInstance) {
    logger.warn('Streaming service already initialized, returning existing instance');
    return streamingServiceInstance;
  }

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
