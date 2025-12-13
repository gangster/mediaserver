/**
 * Streaming routes (Hono).
 *
 * These are non-tRPC routes for HLS streaming.
 * tRPC is not ideal for streaming binary content.
 *
 * @see docs/TRANSCODING_PIPELINE.md for specification
 */

import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { HTTPException } from 'hono/http-exception';
import { getStreamingService } from '../services/streaming-service.js';
import { verifyAccessToken } from '../lib/auth.js';
import { logger } from '../lib/logger.js';
import { HLS_MIME_TYPES } from '../services/hls-playlist.js';

/** Context variables set by auth middleware */
type StreamVariables = {
  userId: string;
  userRole: string;
};

export const streamRouter = new Hono<{ Variables: StreamVariables }>();

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

  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) {
    throw new HTTPException(500, { message: 'Server configuration error' });
  }

  try {
    const payload = verifyAccessToken(token, jwtSecret);
    if (!payload) {
      throw new HTTPException(401, { message: 'Invalid token' });
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
 * Returns session ID and master playlist URL.
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
 */
streamRouter.get('/:sessionId/master.m3u8', async (c) => {
  const sessionId = c.req.param('sessionId');

  try {
    const streamingService = getStreamingService();
    const playlist = streamingService.getMasterPlaylist(sessionId);

    return c.text(playlist, 200, {
      'Content-Type': HLS_MIME_TYPES.playlist,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to get master playlist');
    throw new HTTPException(404, { message: 'Session not found' });
  }
});

/**
 * Get media HLS playlist.
 */
streamRouter.get('/:sessionId/playlist.m3u8', async (c) => {
  const sessionId = c.req.param('sessionId');

  try {
    const streamingService = getStreamingService();
    const playlist = streamingService.getMediaPlaylist(sessionId);

    return c.text(playlist, 200, {
      'Content-Type': HLS_MIME_TYPES.playlist,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to get media playlist');
    throw new HTTPException(404, { message: 'Session or playlist not found' });
  }
});

/**
 * Get video segment.
 */
streamRouter.get('/:sessionId/segment/:index.ts', async (c) => {
  const sessionId = c.req.param('sessionId');
  const indexStr = c.req.param('index') ?? '';
  const index = parseInt(indexStr, 10);

  if (isNaN(index) || index < 0) {
    throw new HTTPException(400, { message: 'Invalid segment index' });
  }

  try {
    const streamingService = getStreamingService();
    const segment = await streamingService.getSegment(sessionId, index);

    return stream(c, async (stream) => {
      c.header('Content-Type', segment.contentType);
      c.header('Content-Length', segment.size.toString());
      c.header('Cache-Control', 'max-age=3600');

      for await (const chunk of segment.stream) {
        await stream.write(chunk as Uint8Array);
      }
    });
  } catch (error) {
    logger.error({ error, sessionId, index }, 'Failed to get segment');
    throw new HTTPException(404, { message: 'Segment not found' });
  }
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

    return stream(c, async (stream) => {
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
        await stream.write(chunk as Uint8Array);
      }
    });
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to stream file');
    throw new HTTPException(404, { message: 'File not found' });
  }
});

/**
 * Seek to position in session.
 */
streamRouter.post('/:sessionId/seek', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const { position } = body;

  if (typeof position !== 'number' || position < 0) {
    throw new HTTPException(400, { message: 'Invalid position' });
  }

  try {
    const streamingService = getStreamingService();
    await streamingService.seek(sessionId, position);

    return c.json({ success: true, position });
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to seek');
    throw new HTTPException(500, { message: 'Seek failed' });
  }
});

/**
 * Switch audio track.
 */
streamRouter.post('/:sessionId/audio', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const { trackIndex } = body;

  if (typeof trackIndex !== 'number' || trackIndex < 0) {
    throw new HTTPException(400, { message: 'Invalid track index' });
  }

  try {
    const streamingService = getStreamingService();
    const plan = await streamingService.switchAudioTrack(sessionId, trackIndex);

    return c.json({
      success: true,
      audio: {
        action: plan.audio.action,
        codec: plan.audio.codec,
        channels: plan.audio.channels,
      },
    });
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to switch audio');
    throw new HTTPException(500, { message: 'Audio switch failed' });
  }
});

/**
 * Toggle subtitles.
 */
streamRouter.post('/:sessionId/subtitles', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const { enabled, trackIndex } = body;

  try {
    const streamingService = getStreamingService();
    await streamingService.toggleSubtitles(sessionId, enabled, trackIndex);

    return c.json({ success: true, enabled, trackIndex });
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to toggle subtitles');
    throw new HTTPException(500, { message: 'Subtitle toggle failed' });
  }
});

/**
 * Session heartbeat - updates progress and keeps session alive.
 */
streamRouter.post('/:sessionId/heartbeat', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const { position, isPlaying } = body;

  try {
    const streamingService = getStreamingService();
    const session = streamingService.getSession(sessionId);

    if (!session) {
      throw new HTTPException(404, { message: 'Session not found' });
    }

    // Update last access time (done internally by getSession operations)
    // TODO: Update watch progress in database

    return c.json({
      success: true,
      sessionId,
      position,
      isPlaying,
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error({ error, sessionId }, 'Heartbeat failed');
    throw new HTTPException(500, { message: 'Heartbeat failed' });
  }
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
