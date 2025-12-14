/**
 * Playback router - watch progress and streaming sessions.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from './trpc.js';
import {
  createSessionInputSchema,
  updateWatchProgressInputSchema,
  sessionHeartbeatInputSchema,
  sessionSeekInputSchema,
  uuidSchema,
  idSchema,
} from '@mediaserver/config';
import { generateId } from '@mediaserver/core';
import type { SkipSegments } from '@mediaserver/core';
import {
  watchProgress,
  playbackSessions,
  movies,
  episodes,
  tvShows,
  eq,
  and,
  desc,
  sql,
} from '@mediaserver/db';
import { getStreamingService } from '../services/streaming-service.js';
import { logger } from '../lib/logger.js';

/** Threshold percentage for marking as watched */
const WATCHED_THRESHOLD = 90;

export const playbackRouter = router({
  /**
   * Get watch progress for a specific item.
   */
  getProgress: protectedProcedure
    .input(
      z.object({
        mediaType: z.enum(['movie', 'episode']),
        mediaId: uuidSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const progress = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, input.mediaType),
          eq(watchProgress.mediaId, input.mediaId)
        ),
      });

      // Return null instead of undefined (TanStack Query requirement)
      return progress ?? null;
    }),

  /**
   * Update watch progress.
   * Called periodically during playback.
   */
  updateProgress: protectedProcedure
    .input(updateWatchProgressInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { mediaType, mediaId, position, duration } = input;

      // Calculate percentage
      const percentage = duration > 0 ? Math.round((position / duration) * 100) : 0;
      const isWatched = percentage >= WATCHED_THRESHOLD;

      // Find existing progress
      const existing = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, mediaType),
          eq(watchProgress.mediaId, mediaId)
        ),
      });

      const now = new Date().toISOString();

      if (existing) {
        await ctx.db
          .update(watchProgress)
          .set({
            position,
            duration,
            percentage,
            isWatched: isWatched || existing.isWatched,
            watchedAt: isWatched && !existing.isWatched ? now : existing.watchedAt,
            updatedAt: now,
          })
          .where(eq(watchProgress.id, existing.id));
      } else {
        await ctx.db.insert(watchProgress).values({
          id: generateId(),
          userId: ctx.userId,
          mediaType,
          mediaId,
          position,
          duration,
          percentage,
          isWatched,
          watchedAt: isWatched ? now : null,
          playCount: 1,
        });
      }

      return { success: true, percentage, isWatched };
    }),

  /**
   * Create a playback session.
   * Returns the streaming URL and session ID.
   */
  createSession: protectedProcedure
    .input(createSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { mediaType, mediaId, profile = 'original', startPosition = 0 } = input;

      logger.info({ 
        userId: ctx.userId, 
        mediaType, 
        mediaId, 
        profile, 
        startPosition 
      }, '[playback.createSession] Creating session');

      try {
        // Get the streaming service
        const streamingService = getStreamingService();
        
        // Create session via streaming service (handles probing, planning, etc.)
        const result = await streamingService.createSession({
          userId: ctx.userId,
          mediaType,
          mediaId,
          startPosition,
          // userAgent would come from request context in a real implementation
        });

        logger.info({ 
          sessionId: result.sessionId, 
          masterPlaylistUrl: result.masterPlaylistUrl,
          mode: result.plan.mode,
          directPlay: result.directPlay
        }, '[playback.createSession] Session created via StreamingService');

        // Also create a record in the playback_sessions table for tracking
        await ctx.db.insert(playbackSessions).values({
          id: result.sessionId,
          userId: ctx.userId,
          mediaType,
          mediaId,
          profile,
          startPosition: result.startPosition,
          lastHeartbeat: new Date().toISOString(),
        });

        return {
          sessionId: result.sessionId,
          masterPlaylist: result.masterPlaylistUrl,
          profile,
          directPlay: result.directPlay,
          startPosition: result.startPosition,
          duration: result.duration,
        };
      } catch (err) {
        logger.error({ 
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          mediaType, 
          mediaId 
        }, '[playback.createSession] Failed to create session');
        
        // Check if it's a "not found" error
        if (err instanceof Error && err.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: err.message,
          });
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to create playback session',
        });
      }
    }),

  /**
   * Session heartbeat - keeps session alive and updates position.
   * Also refreshes the in-memory streaming service session to prevent cleanup.
   */
  heartbeat: protectedProcedure
    .input(sessionHeartbeatInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { sessionId, position, isPlaying } = input;

      // Update session heartbeat
      const session = await ctx.db.query.playbackSessions.findFirst({
        where: eq(playbackSessions.id, sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      // Verify session belongs to user
      if (session.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Session does not belong to you',
        });
      }

      // Update database heartbeat
      await ctx.db
        .update(playbackSessions)
        .set({ lastHeartbeat: new Date().toISOString() })
        .where(eq(playbackSessions.id, sessionId));

      // Also refresh the in-memory streaming service session
      // This prevents automatic cleanup due to inactivity
      // Returns false if the in-memory session is gone (server restart, etc.)
      let sessionActive = true;
      try {
        const streamingService = getStreamingService();
        sessionActive = streamingService.refreshSessionAccess(sessionId);
      } catch {
        // Streaming service might not be initialized
        sessionActive = false;
      }

      // Update watch progress if playing
      if (isPlaying) {
        // Get media duration
        let duration = 0;
        if (session.mediaType === 'movie') {
          const movie = await ctx.db.query.movies.findFirst({
            where: eq(movies.id, session.mediaId),
          });
          duration = movie?.duration ?? 0;
        } else {
          const episode = await ctx.db.query.episodes.findFirst({
            where: eq(episodes.id, session.mediaId),
          });
          duration = episode?.duration ?? 0;
        }

        // Update progress
        const percentage = duration > 0 ? Math.round((position / duration) * 100) : 0;
        const isWatched = percentage >= WATCHED_THRESHOLD;
        const now = new Date().toISOString();

        const existing = await ctx.db.query.watchProgress.findFirst({
          where: and(
            eq(watchProgress.userId, ctx.userId),
            eq(watchProgress.mediaType, session.mediaType),
            eq(watchProgress.mediaId, session.mediaId)
          ),
        });

        if (existing) {
          await ctx.db
            .update(watchProgress)
            .set({
              position,
              duration,
              percentage,
              isWatched: isWatched || existing.isWatched,
              watchedAt: isWatched && !existing.isWatched ? now : existing.watchedAt,
              updatedAt: now,
            })
            .where(eq(watchProgress.id, existing.id));
        } else {
          await ctx.db.insert(watchProgress).values({
            id: generateId(),
            userId: ctx.userId,
            mediaType: session.mediaType,
            mediaId: session.mediaId,
            position,
            duration,
            percentage,
            isWatched,
            watchedAt: isWatched ? now : null,
            playCount: 1,
          });
        }
      }

      // Get transcoded progress so client can make better seek decisions
      let transcodedTime = 0;
      if (sessionActive) {
        try {
          const streamingService = getStreamingService();
          transcodedTime = streamingService.getTranscodedTime(sessionId) ?? 0;
        } catch {
          // Non-critical - client will fall back to server-side seek if needed
        }
      }

      // Return session status - client should recreate session if not active
      return { 
        success: true,
        sessionActive, // false means server lost the session (restart, etc.) - client should recreate
        transcodedTime, // how far FFmpeg has transcoded - helps client decide local vs server seek
      };
    }),

  /**
   * Seek to a new position in a playback session.
   * For transcoded content, this restarts FFmpeg at the new position.
   * The endpoint waits for the first segment to be ready before returning,
   * enabling immediate playback after seek.
   */
  seek: protectedProcedure
    .input(sessionSeekInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { sessionId, position } = input;

      logger.info({ sessionId, position, userId: ctx.userId }, '[playback.seek] Seek requested');

      // Verify session exists and belongs to user
      const session = await ctx.db.query.playbackSessions.findFirst({
        where: eq(playbackSessions.id, sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      if (session.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Session does not belong to you',
        });
      }

      try {
        const streamingService = getStreamingService();
        
        // Check if in-memory session exists before seeking
        const memorySession = streamingService.getSession(sessionId);
        if (!memorySession) {
          logger.warn(
            { sessionId, position },
            '[playback.seek] Session exists in DB but not in memory - server may have restarted'
          );
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Session expired - please recreate',
          });
        }
        
        const result = await streamingService.seek(sessionId, position);

        logger.info(
          { sessionId, position, epochIndex: result.epochIndex, transcodedTime: result.transcodedTime },
          '[playback.seek] Seek completed'
        );

        return {
          success: true,
          epochIndex: result.epochIndex,
          startPosition: result.startPosition,
          transcodedTime: result.transcodedTime,
        };
      } catch (err) {
        // Re-throw TRPCErrors as-is
        if (err instanceof TRPCError) {
          throw err;
        }
        
        logger.error(
          { error: err instanceof Error ? err.message : String(err), sessionId, position },
          '[playback.seek] Seek failed'
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to seek',
        });
      }
    }),

  /**
   * Get the current transcoded progress for a session.
   * Returns how far the transcode has progressed (in source file time).
   * Useful for the client to know if it needs to trigger a server-side seek.
   */
  getTranscodedProgress: protectedProcedure
    .input(z.object({ sessionId: idSchema }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.query.playbackSessions.findFirst({
        where: eq(playbackSessions.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      if (session.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Session does not belong to you',
        });
      }

      try {
        const streamingService = getStreamingService();
        const transcodedTime = streamingService.getTranscodedTime(input.sessionId);

        return {
          sessionId: input.sessionId,
          transcodedTime: transcodedTime ?? 0,
        };
      } catch {
        return {
          sessionId: input.sessionId,
          transcodedTime: 0,
        };
      }
    }),

  /**
   * End a playback session.
   */
  endSession: protectedProcedure
    .input(z.object({ sessionId: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.playbackSessions.findFirst({
        where: eq(playbackSessions.id, input.sessionId),
      });

      if (!session) {
        return { success: true }; // Already ended or doesn't exist
      }

      // Verify session belongs to user
      if (session.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Session does not belong to you',
        });
      }

      // Delete session
      await ctx.db
        .delete(playbackSessions)
        .where(eq(playbackSessions.id, input.sessionId));

      // TODO: Clean up any transcoding jobs associated with this session

      return { success: true };
    }),

  /**
   * Get continue watching items for the current user.
   */
  continueWatching: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      // Get in-progress items (not fully watched, position > 0)
      const inProgress = await ctx.db.query.watchProgress.findMany({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.isWatched, false),
          sql`${watchProgress.position} > 0`,
          sql`${watchProgress.percentage} < ${WATCHED_THRESHOLD}`
        ),
        orderBy: [desc(watchProgress.updatedAt)],
        limit: input.limit,
      });

      // Fetch media details for each item
      const items = await Promise.all(
        inProgress.map(async (progress) => {
          if (progress.mediaType === 'movie') {
            const movie = await ctx.db.query.movies.findFirst({
              where: eq(movies.id, progress.mediaId),
            });

            if (!movie) return null;

            return {
              type: 'movie' as const,
              id: movie.id,
              title: movie.title,
              posterPath: movie.posterPath,
              backdropPath: movie.backdropPath,
              year: movie.year,
              progress: {
                position: progress.position,
                duration: progress.duration,
                percentage: progress.percentage,
              },
            };
          } else {
            const episode = await ctx.db.query.episodes.findFirst({
              where: eq(episodes.id, progress.mediaId),
            });

            if (!episode) return null;

            const show = await ctx.db.query.tvShows.findFirst({
              where: eq(tvShows.id, episode.showId),
            });

            return {
              type: 'episode' as const,
              id: episode.id,
              showId: episode.showId,
              showTitle: show?.title ?? 'Unknown Show',
              title: episode.title,
              posterPath: show?.posterPath,
              backdropPath: show?.backdropPath,
              stillPath: episode.stillPath,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              progress: {
                position: progress.position,
                duration: progress.duration,
                percentage: progress.percentage,
              },
            };
          }
        })
      );

      return items.filter((item) => item !== null);
    }),

  /**
   * Get recently watched items.
   */
  recentlyWatched: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const watched = await ctx.db.query.watchProgress.findMany({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.isWatched, true)
        ),
        orderBy: [desc(watchProgress.watchedAt)],
        limit: input.limit,
      });

      const items = await Promise.all(
        watched.map(async (progress) => {
          if (progress.mediaType === 'movie') {
            const movie = await ctx.db.query.movies.findFirst({
              where: eq(movies.id, progress.mediaId),
            });

            if (!movie) return null;

            return {
              type: 'movie' as const,
              id: movie.id,
              title: movie.title,
              posterPath: movie.posterPath,
              year: movie.year,
              watchedAt: progress.watchedAt,
            };
          } else {
            const episode = await ctx.db.query.episodes.findFirst({
              where: eq(episodes.id, progress.mediaId),
            });

            if (!episode) return null;

            const show = await ctx.db.query.tvShows.findFirst({
              where: eq(tvShows.id, episode.showId),
            });

            return {
              type: 'episode' as const,
              id: episode.id,
              showId: episode.showId,
              showTitle: show?.title ?? 'Unknown Show',
              title: episode.title,
              posterPath: show?.posterPath,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              watchedAt: progress.watchedAt,
            };
          }
        })
      );

      return items.filter((item) => item !== null);
    }),

  /**
   * Get active playback sessions (admin only - for dashboard).
   */
  activeSessions: protectedProcedure.query(async ({ ctx }) => {
    // Only owner/admin can see all sessions
    const condition =
      ctx.userRole === 'owner' || ctx.userRole === 'admin'
        ? undefined
        : eq(playbackSessions.userId, ctx.userId);

    const sessions = await ctx.db.query.playbackSessions.findMany({
      where: condition,
      orderBy: [desc(playbackSessions.createdAt)],
    });

    return sessions;
  }),

  /**
   * Get skip segments (intro/credits) for a media item.
   */
  getSkipSegments: protectedProcedure
    .input(
      z.object({
        mediaType: z.enum(['movie', 'episode']),
        mediaId: uuidSchema,
      })
    )
    .query(async ({ ctx, input }): Promise<SkipSegments> => {
      const { mediaType, mediaId } = input;

      if (mediaType === 'movie') {
        const movie = await ctx.db.query.movies.findFirst({
          where: eq(movies.id, mediaId),
          columns: {
            creditsStart: true,
            duration: true,
          },
        });

        if (!movie) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Movie not found',
          });
        }

        // Movies only have credits, not intro
        return {
          credits:
            movie.creditsStart !== null && movie.duration
              ? { start: movie.creditsStart, end: movie.duration }
              : undefined,
        };
      } else {
        const episode = await ctx.db.query.episodes.findFirst({
          where: eq(episodes.id, mediaId),
          columns: {
            introStart: true,
            introEnd: true,
            creditsStart: true,
            duration: true,
          },
        });

        if (!episode) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Episode not found',
          });
        }

        return {
          intro:
            episode.introStart !== null && episode.introEnd !== null
              ? { start: episode.introStart, end: episode.introEnd }
              : undefined,
          credits:
            episode.creditsStart !== null && episode.duration
              ? { start: episode.creditsStart, end: episode.duration }
              : undefined,
        };
      }
    }),

  /**
   * Update skip segments for a media item (admin only).
   * Used to manually set intro/credits timestamps.
   */
  updateSkipSegments: adminProcedure
    .input(
      z.object({
        mediaType: z.enum(['movie', 'episode']),
        mediaId: uuidSchema,
        introStart: z.number().min(0).nullable().optional(),
        introEnd: z.number().min(0).nullable().optional(),
        creditsStart: z.number().min(0).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { mediaType, mediaId, introStart, introEnd, creditsStart } = input;

      if (mediaType === 'movie') {
        const movie = await ctx.db.query.movies.findFirst({
          where: eq(movies.id, mediaId),
        });

        if (!movie) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Movie not found',
          });
        }

        await ctx.db
          .update(movies)
          .set({
            creditsStart: creditsStart ?? null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(movies.id, mediaId));
      } else {
        const episode = await ctx.db.query.episodes.findFirst({
          where: eq(episodes.id, mediaId),
        });

        if (!episode) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Episode not found',
          });
        }

        await ctx.db
          .update(episodes)
          .set({
            introStart: introStart ?? null,
            introEnd: introEnd ?? null,
            creditsStart: creditsStart ?? null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(episodes.id, mediaId));
      }

      return { success: true };
    }),
});


