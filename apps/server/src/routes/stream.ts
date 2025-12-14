/**
 * Streaming routes (Hono).
 *
 * SIMPLIFIED ARCHITECTURE:
 * - FFmpeg writes segments + playlist.m3u8 to disk
 * - We just serve those files directly
 * - No complex in-memory state or custom playlist generation
 *
 * @see docs/TRANSCODING_PIPELINE.md for specification
 */

import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { HTTPException } from 'hono/http-exception';
import { getStreamingService } from '../services/streaming-service.js';
import { verifyAccessToken } from '../lib/auth.js';
import { logger } from '../lib/logger.js';

// Transcode output directory - must match streaming-service.ts
const TRANSCODE_DIR = '/tmp/mediaserver/transcode';

// Define context variables for type safety
type StreamVariables = {
  userId: string;
  userRole: string;
};

export const streamRouter = new Hono<{ Variables: StreamVariables }>();

// Get JWT secret from environment
const JWT_SECRET = process.env['JWT_SECRET'] ?? '';

/**
 * Authentication middleware for stream routes.
 * Supports both header and query param auth for HLS compatibility.
 */
streamRouter.use('/*', async (c, next) => {
  // Try header first
  let token = c.req.header('Authorization')?.replace('Bearer ', '');

  // Fall back to query param (needed for HLS segments)
  if (!token) {
    token = c.req.query('token');
  }

  if (!token) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  try {
    const payload = verifyAccessToken(token, JWT_SECRET);
    if (!payload) {
      throw new Error('Invalid token payload');
    }
    c.set('userId', payload.sub);
    c.set('userRole', payload.role);
  } catch {
    throw new HTTPException(401, { message: 'Invalid token' });
  }

  await next();
});

/**
 * Create a new playback session.
 * Starts FFmpeg transcoding and returns session ID.
 */
streamRouter.post('/session', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  const {
    mediaType,
    mediaId,
    startPosition = 0,
    audioTrackIndex,
    subtitleTrackIndex,
    burnSubtitles = false,
    preferredAudioLanguage,
    preferredSubtitleLanguage,
  } = body;

  if (!mediaType || !mediaId) {
    throw new HTTPException(400, { message: 'mediaType and mediaId required' });
  }

  try {
    const streamingService = getStreamingService();
    const result = await streamingService.createSession({
      userId,
      mediaType,
      mediaId,
      startPosition,
      userAgent: c.req.header('User-Agent'),
      audioTrackIndex,
      subtitleTrackIndex,
      burnSubtitles,
      preferredAudioLanguage,
      preferredSubtitleLanguage,
    });

    return c.json({
      sessionId: result.sessionId,
      masterPlaylist: result.masterPlaylistUrl,
      directPlay: result.directPlay,
      startPosition: result.startPosition,
      duration: result.duration,
      plan: {
        mode: result.plan.mode,
        transport: result.plan.transport,
        container: result.plan.container,
        video: {
          action: result.plan.video.action,
          codec: result.plan.video.codec,
        },
        audio: {
          action: result.plan.audio.action,
          codec: result.plan.audio.codec,
          channels: result.plan.audio.channels,
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create playback session');
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : 'Failed to create session',
    });
  }
});

/**
 * Get master HLS playlist.
 * SIMPLIFIED: Read from disk (written during session creation).
 */
streamRouter.get('/:sessionId/master.m3u8', async (c) => {
  const sessionId = c.req.param('sessionId');
  const playlistPath = join(TRANSCODE_DIR, sessionId, 'master.m3u8');

  try {
    const playlistContent = await readFile(playlistPath, 'utf-8');

    logger.debug({ sessionId, playlistPath }, '[Stream] Serving master playlist from disk');

    return c.text(playlistContent, 200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
  } catch (error) {
    logger.error({ error, sessionId, playlistPath }, 'Master playlist not found on disk');
    throw new HTTPException(404, { message: 'Session not found' });
  }
});

/**
 * Get media HLS playlist.
 * SIMPLIFIED: Read FFmpeg's playlist.m3u8 directly from disk.
 * Waits for playlist to become available (FFmpeg is transcoding).
 * Appends #EXT-X-ENDLIST if transcoding appears complete.
 */
streamRouter.get('/:sessionId/playlist.m3u8', async (c) => {
  const sessionId = c.req.param('sessionId');
  const playlistPath = join(TRANSCODE_DIR, sessionId, 'playlist.m3u8');

  // Wait for playlist to be available (FFmpeg needs time to start writing)
  const maxWaitMs = 10000; // 10 seconds max wait
  const pollIntervalMs = 200;
  let waited = 0;

  while (waited < maxWaitMs) {
    try {
      const playlistContent = await readFile(playlistPath, 'utf-8');
      
      // Check if we have at least one segment
      if (playlistContent.includes('#EXTINF:')) {
        logger.debug({ sessionId, playlistPath, waited }, '[Stream] Serving playlist from disk');
        
        // Check if FFmpeg has finished (playlist has #EXT-X-ENDLIST)
        let finalPlaylist = playlistContent;
        if (!playlistContent.includes('#EXT-X-ENDLIST')) {
          // Check if file hasn't been modified recently (FFmpeg done)
          const stats = await stat(playlistPath);
          const msSinceModified = Date.now() - stats.mtimeMs;
          
          // If playlist hasn't been updated in 2+ seconds, assume transcoding is done
          if (msSinceModified > 2000) {
            finalPlaylist = playlistContent.trim() + '\n#EXT-X-ENDLIST\n';
            logger.debug({ sessionId, msSinceModified }, '[Stream] Appending ENDLIST (transcoding appears complete)');
          }
        }

        return c.text(finalPlaylist, 200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
      }
    } catch {
      // File doesn't exist yet, keep waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    waited += pollIntervalMs;
  }

  logger.error({ sessionId, playlistPath, waited }, 'Playlist not available after waiting');
  throw new HTTPException(503, { message: 'Playlist not ready yet' });
});

/**
 * Get direct file with range support.
 * Used for direct play mode.
 */
streamRouter.get('/:sessionId/file', async (c) => {
  const sessionId = c.req.param('sessionId');
  const rangeHeader = c.req.header('Range');

  try {
    const streamingService = getStreamingService();

    // Parse range header
    let rangeStart: number | undefined;
    let rangeEnd: number | undefined;

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        rangeStart = parseInt(match[1] ?? '0', 10);
        rangeEnd = match[2] ? parseInt(match[2], 10) : undefined;
      }
    }

    const result = await streamingService.getDirectStream(
      sessionId,
      rangeStart,
      rangeEnd
    );

    const contentLength = result.end - result.start + 1;

    return stream(c, async (s) => {
      c.status(rangeHeader ? 206 : 200);
      c.header('Content-Type', result.contentType);
      c.header('Content-Length', contentLength.toString());
      c.header('Accept-Ranges', 'bytes');

      if (rangeHeader) {
        c.header(
          'Content-Range',
          `bytes ${result.start}-${result.end}/${result.total}`
        );
      }

      for await (const chunk of result.stream) {
        await s.write(chunk as Uint8Array);
      }
    });
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to stream file');
    throw new HTTPException(404, { message: 'File not found' });
  }
});

/**
 * Session heartbeat - updates progress and keeps session alive.
 * Simplified: Just return success if we have a valid session directory.
 */
streamRouter.post('/:sessionId/heartbeat', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const { position, isPlaying } = body;

  // Check if session directory exists (simple validation)
  const sessionDir = join(TRANSCODE_DIR, sessionId);
  try {
    await stat(sessionDir);
  } catch {
    throw new HTTPException(404, { message: 'Session not found' });
  }

  return c.json({
    success: true,
    sessionId,
    position,
    isPlaying,
  });
});

/**
 * End playback session.
 */
streamRouter.delete('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  try {
    const streamingService = getStreamingService();
    await streamingService.endSession(sessionId);

    return c.json({ success: true, sessionId });
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to end session');
    // Return success anyway - session might already be ended
    return c.json({ success: true, sessionId });
  }
});

/**
 * Get session info (for debugging/admin).
 */
streamRouter.get('/:sessionId/info', async (c) => {
  const sessionId = c.req.param('sessionId');
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;

  try {
    const streamingService = getStreamingService();
    const session = streamingService.getSession(sessionId);

    if (!session) {
      throw new HTTPException(404, { message: 'Session not found' });
    }

    // Only allow owner to see full details, or admin
    if (session.userId !== userId && userRole !== 'admin' && userRole !== 'owner') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    return c.json({
      sessionId: session.sessionId,
      mediaId: session.mediaId,
      mediaType: session.mediaType,
      createdAt: session.createdAt,
      lastAccessAt: session.lastAccessAt,
      startPosition: session.startPosition,
      plan: {
        mode: session.plan.mode,
        transport: session.plan.transport,
        container: session.plan.container,
        video: {
          action: session.plan.video.action,
          codec: session.plan.video.codec,
          hwaccel: session.plan.video.hwaccel,
        },
        audio: {
          action: session.plan.audio.action,
          codec: session.plan.audio.codec,
          channels: session.plan.audio.channels,
        },
        subtitles: session.plan.subtitles,
        reasonCodes: session.plan.reasonCodes,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error({ error, sessionId }, 'Failed to get session info');
    throw new HTTPException(500, { message: 'Failed to get session info' });
  }
});

/**
 * Get all active sessions (admin only).
 */
streamRouter.get('/admin/sessions', async (c) => {
  const userRole = c.get('userRole') as string;

  if (userRole !== 'admin' && userRole !== 'owner') {
    throw new HTTPException(403, { message: 'Forbidden' });
  }

  try {
    const streamingService = getStreamingService();
    const sessions = streamingService.getActiveSessions();

    return c.json({
      count: sessions.length,
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        userId: s.userId,
        mediaId: s.mediaId,
        mediaType: s.mediaType,
        mode: s.plan.mode,
        createdAt: s.createdAt,
        lastAccessAt: s.lastAccessAt,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get active sessions');
    throw new HTTPException(500, { message: 'Failed to get sessions' });
  }
});

/**
 * Get video segment.
 * SIMPLIFIED: Serve segment file directly from disk using FFmpeg's naming.
 * FFmpeg names segments as segment_00000.ts, segment_00001.ts, etc.
 * 
 * NOTE: This catch-all route MUST be defined LAST to avoid intercepting
 * other routes like /file, /heartbeat, /info.
 */
streamRouter.get('/:sessionId/:filename', async (c) => {
  const sessionId = c.req.param('sessionId');
  const filename = c.req.param('filename');

  // Only handle .ts segment files
  if (!filename || !filename.endsWith('.ts') || !filename.startsWith('segment_')) {
    throw new HTTPException(400, { message: 'Invalid segment filename' });
  }

  const segmentPath = join(TRANSCODE_DIR, sessionId, filename);

  try {
    const stats = await stat(segmentPath);

    logger.debug({ sessionId, filename, segmentPath, size: stats.size }, '[Stream] Serving segment from disk');

    return stream(c, async (s) => {
      c.header('Content-Type', 'video/MP2T');
      c.header('Content-Length', stats.size.toString());
      c.header('Cache-Control', 'max-age=3600');

      const fileStream = createReadStream(segmentPath);
      for await (const chunk of fileStream) {
        await s.write(chunk as Uint8Array);
      }
    });
  } catch (error) {
    logger.error({ error, sessionId, filename, segmentPath }, 'Segment not found on disk');
    throw new HTTPException(404, { message: 'Segment not found' });
  }
});
