/**
 * Playback router - watch progress and streaming sessions.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure } from './trpc.js';
import {
  createSessionInputSchema,
  updateWatchProgressInputSchema,
  sessionHeartbeatInputSchema,
  uuidSchema,
} from '@mediaserver/config';
import { generateId } from '@mediaserver/core';
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

      return progress;
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

      // Verify media exists and get file info
      let directPlayable: boolean | null;

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

        directPlayable = movie.directPlayable;
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

        directPlayable = episode.directPlayable;
      }

      // Create session
      const sessionId = generateId();
      await ctx.db.insert(playbackSessions).values({
        id: sessionId,
        userId: ctx.userId,
        mediaType,
        mediaId,
        profile,
        startPosition,
        lastHeartbeat: new Date().toISOString(),
      });

      // Determine if we can direct play or need to transcode
      const canDirectPlay = profile === 'original' && directPlayable;

      // Build streaming URL
      const baseUrl = `/api/stream/${sessionId}`;

      return {
        sessionId,
        masterPlaylist: `${baseUrl}/master.m3u8`,
        profile,
        directPlay: canDirectPlay ?? false,
        startPosition,
      };
    }),

  /**
   * Session heartbeat - keeps session alive and updates position.
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

      // Update heartbeat
      await ctx.db
        .update(playbackSessions)
        .set({ lastHeartbeat: new Date().toISOString() })
        .where(eq(playbackSessions.id, sessionId));

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

      return { success: true };
    }),

  /**
   * End a playback session.
   */
  endSession: protectedProcedure
    .input(z.object({ sessionId: uuidSchema }))
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
});

