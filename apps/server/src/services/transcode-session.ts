/**
 * Transcode Session Manager
 *
 * Manages active transcoding sessions, including:
 * - Session lifecycle (create, pause, resume, end)
 * - Epoch handling for seeks and track switches
 * - FFmpeg process management
 * - Segment tracking and cleanup
 *
 * @see docs/TRANSCODING_PIPELINE.md §9 for specification
 */

import { EventEmitter } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { writePidFile } from './process-cleanup.js';
import type {
  TranscodeSessionState,
  PlaybackPlan,
  EpochTransition,
  FFmpegProcessState,
  HLSMediaPlaylist,
  HLSSegment,
  ServerCapabilities,
} from '@mediaserver/core';
import {
  buildCommandForMode,
  commandToString,
  type FFmpegBuildOptions,
} from './ffmpeg-builder.js';
import {
  createMediaPlaylist,
  addSegmentToPlaylist,
  startNewEpoch,
  finalizePlaylist,
  generateMediaPlaylist,
} from './hls-playlist.js';
import { logger } from '../lib/logger.js';

/**
 * Session events:
 * - 'segment:ready': (segment: HLSSegment) => void
 * - 'epoch:transition': (transition: EpochTransition) => void
 * - 'playlist:updated': (playlist: HLSMediaPlaylist) => void
 * - 'session:started': (sessionId: string) => void
 * - 'session:ended': (sessionId: string, reason: string) => void
 * - 'session:error': (sessionId: string, error: Error) => void
 * - 'ffmpeg:progress': (sessionId: string, progress: FFmpegProgress) => void
 */

/** FFmpeg progress info parsed from stderr */
export interface FFmpegProgress {
  frame: number;
  fps: number;
  time: number;
  bitrate: number;
  speed: number;
}

/** Session configuration */
export interface SessionConfig {
  cacheDir: string;
  segmentDuration: number;
  maxSegmentsBehindPlayhead: number;
  firstSegmentTimeoutMs: number;
  noProgressTimeoutMs: number;
}

/** Default session configuration */
const DEFAULT_CONFIG: SessionConfig = {
  cacheDir: '/tmp/mediaserver/transcode',
  segmentDuration: 4,
  maxSegmentsBehindPlayhead: 5,
  firstSegmentTimeoutMs: 45000, // 45 seconds - 4K transcoding can be slow
  noProgressTimeoutMs: 60000,   // 60 seconds
};

/**
 * Active transcode session.
 */
export class TranscodeSession extends EventEmitter {
  readonly sessionId: string;
  readonly mediaId: string;
  readonly userId: string;
  readonly plan: PlaybackPlan;

  private state: TranscodeSessionState;
  private ffmpegProcess: ChildProcess | null = null;
  private ffmpegState: FFmpegProcessState;
  private playlist: HLSMediaPlaylist;
  private config: SessionConfig;
  private serverCaps: ServerCapabilities;
  private inputPath: string;
  private outputDir: string;
  private currentSegmentIndex: number = 0;
  private firstSegmentTimeout: NodeJS.Timeout | null = null;
  private noProgressTimeout: NodeJS.Timeout | null = null;
  /** Mutex to prevent concurrent seek operations */
  private seekInProgress: Promise<void> | null = null;

  constructor(
    plan: PlaybackPlan,
    inputPath: string,
    serverCaps: ServerCapabilities,
    config: Partial<SessionConfig> = {}
  ) {
    super();

    this.sessionId = plan.sessionId;
    this.mediaId = plan.mediaId;
    this.userId = plan.userId;
    this.plan = plan;
    this.inputPath = inputPath;
    this.serverCaps = serverCaps;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize output directory
    this.outputDir = join(
      this.config.cacheDir,
      this.sessionId
    );

    // Initialize state
    this.state = {
      sessionId: this.sessionId,
      userId: this.userId,
      mediaId: this.mediaId,
      playbackPlan: plan,
      currentEpoch: {
        epochIndex: 0,
        mediaSequenceBase: 0,
        discontinuitySequence: 0,
        segmentIndex: 0,
      },
      currentPositionSeconds: 0,
      status: 'active',
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    // Initialize FFmpeg state
    this.ffmpegState = {
      status: 'stopped',
      segmentsProduced: 0,
      currentMediaTime: 0,
      restartCount: 0,
    };

    // Initialize playlist
    this.playlist = createMediaPlaylist(
      this.sessionId,
      this.mediaId,
      this.config.segmentDuration
    );
  }

  /**
   * Start the transcoding session.
   */
  async start(startPosition: number = 0): Promise<void> {
    logger.info(
      { sessionId: this.sessionId, startPosition },
      'Starting transcode session'
    );

    // Ensure output directory exists
    await mkdir(this.outputDir, { recursive: true });

    // Update state
    this.state.currentPositionSeconds = startPosition;
    this.state.status = 'active';

    // Start FFmpeg
    await this.startFFmpeg(startPosition);

    this.emit('session:started', this.sessionId);
  }

  /**
   * Seek to a new position.
   * Creates a new epoch with discontinuity.
   * 
   * Uses a mutex to prevent concurrent seek operations from spawning multiple FFmpeg processes.
   * 
   * @param position - Target position in source file time (seconds)
   * @param waitForFirstSegment - If true, waits for first segment before returning (default: true)
   * @returns Promise that resolves when seek is complete and first segment is ready
   */
  async seek(position: number, waitForFirstSegment: boolean = true): Promise<void> {
    // Wait for any in-progress seek to complete first
    if (this.seekInProgress) {
      logger.info(
        { sessionId: this.sessionId, position },
        'Waiting for previous seek to complete'
      );
      try {
        await this.seekInProgress;
      } catch {
        // Previous seek failed, continue with new seek
      }
    }

    // Create and store the seek promise
    this.seekInProgress = this.doSeek(position, waitForFirstSegment);
    
    try {
      await this.seekInProgress;
    } finally {
      this.seekInProgress = null;
    }
  }

  /**
   * Internal seek implementation.
   */
  private async doSeek(position: number, waitForFirstSegment: boolean): Promise<void> {
    logger.info(
      { sessionId: this.sessionId, position, waitForFirstSegment },
      'Seeking transcode session'
    );

    // Stop current FFmpeg process
    await this.stopFFmpeg();

    // Create new epoch
    const newEpochIndex = this.state.currentEpoch.epochIndex + 1;
    this.state.currentEpoch = {
      epochIndex: newEpochIndex,
      mediaSequenceBase: 0,
      discontinuitySequence: this.state.currentEpoch.discontinuitySequence + 1,
      segmentIndex: 0,
    };

    // Update playlist with new epoch
    this.playlist = startNewEpoch(this.playlist, newEpochIndex);

    // Emit epoch transition
    const transition: EpochTransition = {
      sessionId: this.sessionId,
      fromEpoch: newEpochIndex - 1,
      toEpoch: newEpochIndex,
      reason: 'seek',
      mediaTime: position,
      timestamp: new Date().toISOString(),
    };
    this.emit('epoch:transition', transition);

    // Update position
    this.state.currentPositionSeconds = position;
    this.currentSegmentIndex = 0;

    // Restart FFmpeg at new position
    await this.startFFmpeg(position);

    // Wait for first segment to be ready if requested
    if (waitForFirstSegment) {
      await this.waitForFirstSegment();
    }
  }

  /**
   * Wait for the first segment of the current epoch to be ready.
   * Returns immediately if segments already exist.
   */
  private async waitForFirstSegment(): Promise<void> {
    // Check if we already have segments for this epoch
    const epochSegments = this.playlist.segments.filter(
      s => s.epochIndex === this.state.currentEpoch.epochIndex
    );
    if (epochSegments.length > 0) {
      logger.debug({ sessionId: this.sessionId }, 'First segment already available');
      return;
    }

    // Wait for segment:ready event
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener('segment:ready', onSegmentReady);
        this.removeListener('session:error', onError);
        reject(new Error('Timeout waiting for first segment after seek'));
      }, this.config.firstSegmentTimeoutMs);

      const onSegmentReady = (segment: HLSSegment) => {
        // Only resolve for segments in the current epoch
        if (segment.epochIndex === this.state.currentEpoch.epochIndex) {
          clearTimeout(timeout);
          this.removeListener('segment:ready', onSegmentReady);
          this.removeListener('session:error', onError);
          logger.debug(
            { sessionId: this.sessionId, segmentIndex: segment.index },
            'First segment ready after seek'
          );
          resolve();
        }
      };

      const onError = (_sessionId: string, error: Error) => {
        clearTimeout(timeout);
        this.removeListener('segment:ready', onSegmentReady);
        this.removeListener('session:error', onError);
        reject(error);
      };

      this.on('segment:ready', onSegmentReady);
      this.on('session:error', onError);
    });
  }

  /**
   * Get the current transcoded time (end of last segment in current epoch).
   * Useful for clients to know how far they can seek without server-side restart.
   */
  getTranscodedTime(): number {
    const epochSegments = this.playlist.segments.filter(
      s => s.epochIndex === this.state.currentEpoch.epochIndex
    );
    if (epochSegments.length === 0) {
      return this.state.currentPositionSeconds;
    }
    const lastSegment = epochSegments[epochSegments.length - 1];
    return lastSegment?.endTime ?? this.state.currentPositionSeconds;
  }

  /**
   * Switch audio or subtitle track.
   * Creates a new epoch.
   */
  async switchTrack(reason: 'track_switch' | 'subtitle_toggle'): Promise<void> {
    logger.info(
      { sessionId: this.sessionId, reason },
      'Switching track in transcode session'
    );

    // Stop current FFmpeg
    await this.stopFFmpeg();

    // Create new epoch
    const newEpochIndex = this.state.currentEpoch.epochIndex + 1;
    this.state.currentEpoch = {
      ...this.state.currentEpoch,
      epochIndex: newEpochIndex,
      discontinuitySequence: this.state.currentEpoch.discontinuitySequence + 1,
      segmentIndex: 0,
    };

    this.playlist = startNewEpoch(this.playlist, newEpochIndex);

    const transition: EpochTransition = {
      sessionId: this.sessionId,
      fromEpoch: newEpochIndex - 1,
      toEpoch: newEpochIndex,
      reason,
      mediaTime: this.state.currentPositionSeconds,
      timestamp: new Date().toISOString(),
    };
    this.emit('epoch:transition', transition);

    // Restart FFmpeg
    await this.startFFmpeg(this.state.currentPositionSeconds);
  }

  /**
   * Pause the session.
   */
  async pause(): Promise<void> {
    logger.info({ sessionId: this.sessionId }, 'Pausing transcode session');

    // Set status before stopping to prevent restart attempts from FFmpeg exit handler
    this.state.status = 'paused';
    await this.stopFFmpeg();
  }

  /**
   * Resume a paused session.
   */
  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      throw new Error('Session is not paused');
    }

    logger.info({ sessionId: this.sessionId }, 'Resuming transcode session');

    this.state.status = 'active';
    await this.startFFmpeg(this.state.currentPositionSeconds);
  }

  /**
   * End the session and cleanup.
   */
  async end(reason: string = 'normal'): Promise<void> {
    logger.info(
      { sessionId: this.sessionId, reason },
      'Ending transcode session'
    );

    // Set status to 'ending' BEFORE stopping FFmpeg to prevent restart attempts.
    // This avoids a race condition where FFmpeg exit handler could see 'active' status.
    this.state.status = 'ending';

    // Stop FFmpeg
    await this.stopFFmpeg();

    // Clear timeouts
    this.clearTimeouts();

    // Finalize playlist
    this.playlist = finalizePlaylist(this.playlist);
    this.emit('playlist:updated', this.playlist);

    // Update state to final ended status
    this.state.status = 'ended';
    this.state.endedAt = new Date().toISOString();

    this.emit('session:ended', this.sessionId, reason);
  }

  /**
   * Get current session state.
   */
  getState(): TranscodeSessionState {
    return { ...this.state };
  }

  /**
   * Get current playlist.
   */
  getPlaylist(): HLSMediaPlaylist {
    return { ...this.playlist };
  }

  /**
   * Get playlist as string.
   */
  getPlaylistContent(): string {
    return generateMediaPlaylist(this.playlist);
  }

  /**
   * Get segment file path.
   */
  getSegmentPath(index: number): string {
    const filename = `segment_${index.toString().padStart(5, '0')}.ts`;
    return join(this.outputDir, filename);
  }

  /**
   * Cleanup old segments behind playhead.
   */
  async cleanupOldSegments(currentPlayheadIndex: number): Promise<void> {
    const keepFrom = Math.max(0, currentPlayheadIndex - this.config.maxSegmentsBehindPlayhead);

    for (const segment of this.playlist.segments) {
      if (segment.index < keepFrom) {
        try {
          await rm(segment.path, { force: true });
        } catch (error) {
          logger.warn(
            { error, path: segment.path },
            'Failed to cleanup segment'
          );
        }
      }
    }
  }

  /**
   * Cleanup all session files.
   */
  async cleanup(): Promise<void> {
    try {
      await rm(this.outputDir, { recursive: true, force: true });
    } catch (error) {
      logger.warn(
        { error, outputDir: this.outputDir },
        'Failed to cleanup session directory'
      );
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async startFFmpeg(startPosition: number): Promise<void> {
    const playlistPath = join(this.outputDir, 'playlist.m3u8');

    const options: FFmpegBuildOptions = {
      inputPath: this.inputPath,
      outputPath: playlistPath,
      startTime: startPosition,
      segmentDuration: this.config.segmentDuration,
    };

    // Build command
    const args = buildCommandForMode(
      this.plan,
      this.serverCaps.ffmpegManifest,
      options
    );

    logger.info(
      { sessionId: this.sessionId, command: commandToString(args) },
      'Starting FFmpeg'
    );

    // Spawn FFmpeg
    // Use detached: false to keep FFmpeg as a child process
    // This ensures it gets killed when the parent process exits
    this.ffmpegState.status = 'starting';
    this.ffmpegState.startedAt = new Date().toISOString();

    const ffmpeg = spawn(args[0] ?? 'ffmpeg', args.slice(1), {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    this.ffmpegProcess = ffmpeg;
    this.ffmpegState.pid = ffmpeg.pid;

    // Write PID file for tracking (helps with cleanup on restart)
    if (ffmpeg.pid) {
      writePidFile(this.outputDir, ffmpeg.pid).catch((err) => {
        logger.warn({ err, sessionId: this.sessionId }, 'Failed to write FFmpeg PID file');
      });
    }

    // Set up first segment timeout
    this.setFirstSegmentTimeout();

    // Handle stdout (not used for HLS)
    ffmpeg.stdout?.on('data', () => {
      // FFmpeg doesn't output to stdout for HLS
    });

    // Handle stderr (progress output)
    ffmpeg.stderr?.on('data', (data: Buffer) => {
      this.handleFFmpegOutput(data.toString());
    });

    // Handle process exit
    ffmpeg.on('close', (code) => {
      this.handleFFmpegExit(code);
    });

    ffmpeg.on('error', (error) => {
      this.handleFFmpegError(error);
    });

    this.ffmpegState.status = 'running';
  }

  private async stopFFmpeg(): Promise<void> {
    if (!this.ffmpegProcess) return;

    return new Promise((resolve) => {
      const ffmpeg = this.ffmpegProcess;
      if (!ffmpeg) {
        resolve();
        return;
      }

      this.ffmpegState.status = 'stopping';

      // Give FFmpeg time to finish current segment
      const forceKillTimeout = setTimeout(() => {
        ffmpeg.kill('SIGKILL');
      }, 5000);

      ffmpeg.on('close', () => {
        clearTimeout(forceKillTimeout);
        this.ffmpegProcess = null;
        this.ffmpegState.status = 'stopped';
        resolve();
      });

      // Send graceful termination
      ffmpeg.kill('SIGTERM');
    });
  }

  private handleFFmpegOutput(output: string): void {
    // Reset no-progress timeout
    this.setNoProgressTimeout();

    // Parse progress
    const progress = this.parseFFmpegProgress(output);
    if (progress) {
      this.ffmpegState.currentMediaTime = progress.time;
      this.ffmpegState.lastOutputAt = new Date().toISOString();
      this.emit('ffmpeg:progress', this.sessionId, progress);
    }

    // Check for new segments
    this.checkForNewSegments();
  }

  private parseFFmpegProgress(output: string): FFmpegProgress | null {
    // FFmpeg progress format: frame=  123 fps= 30 ... time=00:00:05.00 bitrate=1234.5kbits/s speed=1.5x
    const frameMatch = output.match(/frame=\s*(\d+)/);
    const fpsMatch = output.match(/fps=\s*([\d.]+)/);
    const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
    const bitrateMatch = output.match(/bitrate=\s*([\d.]+)kbits/);
    const speedMatch = output.match(/speed=\s*([\d.]+)x/);

    if (!timeMatch) return null;

    const hours = parseInt(timeMatch[1] ?? '0', 10);
    const minutes = parseInt(timeMatch[2] ?? '0', 10);
    const seconds = parseFloat(timeMatch[3] ?? '0');
    const time = hours * 3600 + minutes * 60 + seconds;

    return {
      frame: parseInt(frameMatch?.[1] ?? '0', 10),
      fps: parseFloat(fpsMatch?.[1] ?? '0'),
      time,
      bitrate: parseFloat(bitrateMatch?.[1] ?? '0'),
      speed: parseFloat(speedMatch?.[1] ?? '0'),
    };
  }

  private async checkForNewSegments(): Promise<void> {
    try {
      const files = await readdir(this.outputDir);
      const segmentFiles = files
        .filter((f) => f.endsWith('.ts'))
        .sort();
      
      logger.debug({ 
        sessionId: this.sessionId, 
        outputDir: this.outputDir,
        totalFiles: files.length,
        segmentFiles: segmentFiles.length,
        currentSegmentIndex: this.currentSegmentIndex 
      }, '[TranscodeSession] Checking for segments');

      for (const filename of segmentFiles) {
        const index = this.parseSegmentIndex(filename);
        if (index === null || index < this.currentSegmentIndex) continue;

        const path = join(this.outputDir, filename);
        const stats = await stat(path);

        // Only count complete segments (file not growing)
        if (stats.size > 0) {
          const segment: HLSSegment = {
            index,
            epochIndex: this.state.currentEpoch.epochIndex,
            duration: this.config.segmentDuration,
            // URL-formatted filename for HLS playlist (matches route pattern)
            filename: `segment/${index}.ts`,
            // Actual file path on disk
            path,
            byteSize: stats.size,
            startTime: this.state.currentPositionSeconds + index * this.config.segmentDuration,
            endTime: this.state.currentPositionSeconds + (index + 1) * this.config.segmentDuration,
            discontinuity: index === 0 && this.state.currentEpoch.epochIndex > 0,
          };

          // Add to playlist
          this.playlist = addSegmentToPlaylist(this.playlist, segment);
          this.currentSegmentIndex = index + 1;

          // Clear first segment timeout
          if (index === 0) {
            this.clearFirstSegmentTimeout();
          }

          // Update FFmpeg state
          this.ffmpegState.segmentsProduced++;

          // Emit events
          this.emit('segment:ready', segment);
          this.emit('playlist:updated', this.playlist);
        }
      }
    } catch (error) {
      logger.warn(
        { error, sessionId: this.sessionId },
        'Error checking for new segments'
      );
    }
  }

  private parseSegmentIndex(filename: string): number | null {
    // Match segment_00000.ts or similar patterns
    const match = filename.match(/segment_?(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  private handleFFmpegExit(code: number | null): void {
    logger.info(
      { sessionId: this.sessionId, exitCode: code, ffmpegStatus: this.ffmpegState.status },
      'FFmpeg process exited'
    );

    this.clearTimeouts();
    this.ffmpegProcess = null;

    if (code === 0) {
      // Normal completion
      this.ffmpegState.status = 'stopped';
    } else if (this.ffmpegState.status === 'stopping') {
      // Intentionally stopped (during seek, pause, or end) - don't restart
      this.ffmpegState.status = 'stopped';
      logger.debug(
        { sessionId: this.sessionId },
        'FFmpeg was intentionally stopped, not restarting'
      );
    } else if (this.state.status === 'active') {
      // Unexpected exit while session is active
      this.ffmpegState.status = 'error';
      this.ffmpegState.errorMessage = `FFmpeg exited with code ${code}`;

      // Attempt restart if within budget
      this.handleFFmpegFailure();
    }
  }

  private handleFFmpegError(error: Error): void {
    logger.error(
      { error, sessionId: this.sessionId },
      'FFmpeg process error'
    );

    this.ffmpegState.status = 'error';
    this.ffmpegState.errorMessage = error.message;

    this.emit('session:error', this.sessionId, error);
  }

  private async handleFFmpegFailure(): Promise<void> {
    const maxRestarts = 3;

    if (this.ffmpegState.restartCount < maxRestarts) {
      this.ffmpegState.restartCount++;
      logger.info(
        {
          sessionId: this.sessionId,
          restartCount: this.ffmpegState.restartCount,
        },
        'Attempting FFmpeg restart'
      );

      // Wait before restart
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Restart at current position
      await this.startFFmpeg(this.state.currentPositionSeconds);
    } else {
      logger.error(
        { sessionId: this.sessionId },
        'Max FFmpeg restarts exceeded'
      );

      this.state.status = 'error';
      this.emit(
        'session:error',
        this.sessionId,
        new Error('Max FFmpeg restarts exceeded')
      );
    }
  }

  private setFirstSegmentTimeout(): void {
    this.clearFirstSegmentTimeout();

    this.firstSegmentTimeout = setTimeout(() => {
      logger.error(
        { sessionId: this.sessionId },
        'First segment timeout exceeded'
      );

      this.emit(
        'session:error',
        this.sessionId,
        new Error('First segment timeout exceeded')
      );
    }, this.config.firstSegmentTimeoutMs);
  }

  private clearFirstSegmentTimeout(): void {
    if (this.firstSegmentTimeout) {
      clearTimeout(this.firstSegmentTimeout);
      this.firstSegmentTimeout = null;
    }
  }

  private setNoProgressTimeout(): void {
    if (this.noProgressTimeout) {
      clearTimeout(this.noProgressTimeout);
    }

    this.noProgressTimeout = setTimeout(() => {
      logger.error(
        { sessionId: this.sessionId },
        'FFmpeg no-progress timeout exceeded'
      );

      this.handleFFmpegFailure();
    }, this.config.noProgressTimeoutMs);
  }

  private clearTimeouts(): void {
    this.clearFirstSegmentTimeout();
    if (this.noProgressTimeout) {
      clearTimeout(this.noProgressTimeout);
      this.noProgressTimeout = null;
    }
  }
}

// =============================================================================
// Session Manager
// =============================================================================

/**
 * Manages multiple transcode sessions.
 */
export class TranscodeSessionManager {
  private sessions: Map<string, TranscodeSession> = new Map();
  private config: SessionConfig;
  private serverCaps: ServerCapabilities;

  constructor(serverCaps: ServerCapabilities, config: Partial<SessionConfig> = {}) {
    this.serverCaps = serverCaps;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new transcode session.
   */
  createSession(plan: PlaybackPlan, inputPath: string): TranscodeSession {
    // Check if session already exists
    if (this.sessions.has(plan.sessionId)) {
      throw new Error(`Session ${plan.sessionId} already exists`);
    }

    // Check concurrent session limit
    const activeCount = this.getActiveSessionCount();
    if (activeCount >= this.serverCaps.maxConcurrentTranscodes) {
      throw new Error(
        `Max concurrent transcodes (${this.serverCaps.maxConcurrentTranscodes}) reached`
      );
    }

    const session = new TranscodeSession(
      plan,
      inputPath,
      this.serverCaps,
      this.config
    );

    this.sessions.set(plan.sessionId, session);

    // Clean up when session ends
    session.on('session:ended', () => {
      this.sessions.delete(plan.sessionId);
    });

    return session;
  }

  /**
   * Get an existing session.
   */
  getSession(sessionId: string): TranscodeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions.
   */
  getActiveSessions(): TranscodeSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.getState().status === 'active'
    );
  }

  /**
   * Get count of active sessions.
   */
  getActiveSessionCount(): number {
    return this.getActiveSessions().length;
  }

  /**
   * End a session.
   */
  async endSession(sessionId: string, reason: string = 'requested'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.end(reason);
      this.sessions.delete(sessionId);
    }
  }

  /**
   * End all sessions.
   */
  async endAllSessions(reason: string = 'shutdown'): Promise<void> {
    const sessions = Array.from(this.sessions.values());
    await Promise.all(sessions.map((s) => s.end(reason)));
    this.sessions.clear();
  }

  /**
   * Cleanup all session files.
   */
  async cleanup(): Promise<void> {
    const sessions = Array.from(this.sessions.values());
    await Promise.all(sessions.map((s) => s.cleanup()));
  }
}
