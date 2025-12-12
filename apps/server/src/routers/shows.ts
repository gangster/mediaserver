/**
 * TV Shows router - list, get, seasons, episodes.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure } from './trpc.js';
import { showsListInputSchema, uuidSchema } from '@mediaserver/config';
import {
  tvShows,
  seasons,
  episodes,
  watchProgress,
  libraryPermissions,
  eq,
  and,
  desc,
  asc,
  like,
  sql,
} from '@mediaserver/db';

export const showsRouter = router({
  /**
   * List TV shows with pagination, sorting, and filtering.
   */
  list: protectedProcedure.input(showsListInputSchema).query(async ({ ctx, input }) => {
    const { libraryId, genre, status, sort, direction, limit, cursor } = input;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (libraryId) {
      conditions.push(eq(tvShows.libraryId, libraryId));
    }

    if (genre) {
      conditions.push(like(tvShows.genres, `%"${genre}"%`));
    }

    if (status) {
      conditions.push(eq(tvShows.status, status));
    }

    // For non-admin users, filter by library permissions
    if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
      const permissions = await ctx.db.query.libraryPermissions.findMany({
        where: and(
          eq(libraryPermissions.userId, ctx.userId),
          eq(libraryPermissions.canView, true)
        ),
      });

      const allowedLibraryIds = permissions.map((p) => p.libraryId);
      if (allowedLibraryIds.length === 0) {
        return { items: [], nextCursor: null };
      }

      conditions.push(
        sql`${tvShows.libraryId} IN (${sql.join(
          allowedLibraryIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
    }

    // Build order by
    const orderFn = direction === 'desc' ? desc : asc;
    const orderColumn = {
      addedAt: tvShows.addedAt,
      title: tvShows.sortTitle,
      year: tvShows.year,
      rating: tvShows.voteAverage,
    }[sort];

    // Handle cursor pagination
    if (cursor) {
      const cursorShow = await ctx.db.query.tvShows.findFirst({
        where: eq(tvShows.id, cursor),
      });

      if (cursorShow) {
        if (sort === 'addedAt') {
          const comparison = direction === 'desc' ? sql`<` : sql`>`;
          conditions.push(
            sql`${tvShows.addedAt} ${comparison} ${cursorShow.addedAt}`
          );
        }
      }
    }

    // Execute query
    const results = await ctx.db.query.tvShows.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: orderColumn ? [orderFn(orderColumn)] : [desc(tvShows.addedAt)],
      limit: limit + 1,
    });

    // Get total count (for stats display)
    const countResult = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(tvShows)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = countResult[0]?.count ?? 0;

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, -1) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return {
      items,
      nextCursor,
      total,
    };
  }),

  /**
   * Get a single TV show by ID.
   */
  get: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const show = await ctx.db.query.tvShows.findFirst({
        where: eq(tvShows.id, input.id),
      });

      if (!show) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'TV show not found',
        });
      }

      // Check library permission for non-admin users
      if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
        const permission = await ctx.db.query.libraryPermissions.findFirst({
          where: and(
            eq(libraryPermissions.userId, ctx.userId),
            eq(libraryPermissions.libraryId, show.libraryId),
            eq(libraryPermissions.canView, true)
          ),
        });

        if (!permission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this show',
          });
        }
      }

      // Get seasons for this show
      const showSeasons = await ctx.db.query.seasons.findMany({
        where: eq(seasons.showId, input.id),
        orderBy: [asc(seasons.seasonNumber)],
      });

      // Parse JSON fields
      const genres = show.genres ? JSON.parse(show.genres) : [];

      return {
        ...show,
        genres,
        seasons: showSeasons,
      };
    }),

  /**
   * Get a season with its episodes.
   */
  getSeason: protectedProcedure
    .input(
      z.object({
        showId: uuidSchema,
        seasonNumber: z.number().int().min(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const show = await ctx.db.query.tvShows.findFirst({
        where: eq(tvShows.id, input.showId),
      });

      if (!show) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'TV show not found',
        });
      }

      const season = await ctx.db.query.seasons.findFirst({
        where: and(
          eq(seasons.showId, input.showId),
          eq(seasons.seasonNumber, input.seasonNumber)
        ),
      });

      if (!season) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Season not found',
        });
      }

      // Get episodes for this season
      const seasonEpisodes = await ctx.db.query.episodes.findMany({
        where: eq(episodes.seasonId, season.id),
        orderBy: [asc(episodes.episodeNumber)],
      });

      // Get watch progress for all episodes
      const episodeIds = seasonEpisodes.map((e) => e.id);
      const progressRecords =
        episodeIds.length > 0
          ? await ctx.db.query.watchProgress.findMany({
              where: and(
                eq(watchProgress.userId, ctx.userId),
                eq(watchProgress.mediaType, 'episode'),
                sql`${watchProgress.mediaId} IN (${sql.join(
                  episodeIds.map((id) => sql`${id}`),
                  sql`, `
                )})`
              ),
            })
          : [];

      const progressMap = new Map(progressRecords.map((p) => [p.mediaId, p]));

      // Attach progress to episodes
      const episodesWithProgress = seasonEpisodes.map((episode) => {
        const progress = progressMap.get(episode.id);
        const mediaStreams = episode.mediaStreams
          ? JSON.parse(episode.mediaStreams)
          : [];
        const subtitlePaths = episode.subtitlePaths
          ? JSON.parse(episode.subtitlePaths)
          : [];

        return {
          ...episode,
          mediaStreams,
          subtitlePaths,
          watchProgress: progress
            ? {
                position: progress.position,
                duration: progress.duration,
                percentage: progress.percentage,
                isWatched: progress.isWatched,
              }
            : null,
        };
      });

      return {
        ...season,
        show: {
          id: show.id,
          title: show.title,
          posterPath: show.posterPath,
        },
        episodes: episodesWithProgress,
      };
    }),

  /**
   * Get a single episode.
   */
  getEpisode: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const episode = await ctx.db.query.episodes.findFirst({
        where: eq(episodes.id, input.id),
      });

      if (!episode) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Episode not found',
        });
      }

      // Get show and season info
      const show = await ctx.db.query.tvShows.findFirst({
        where: eq(tvShows.id, episode.showId),
      });

      const season = await ctx.db.query.seasons.findFirst({
        where: eq(seasons.id, episode.seasonId),
      });

      // Check library permission
      if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
        const permission = await ctx.db.query.libraryPermissions.findFirst({
          where: and(
            eq(libraryPermissions.userId, ctx.userId),
            eq(libraryPermissions.libraryId, show!.libraryId),
            eq(libraryPermissions.canView, true)
          ),
        });

        if (!permission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this episode',
          });
        }
      }

      // Get watch progress
      const progress = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'episode'),
          eq(watchProgress.mediaId, input.id)
        ),
      });

      const mediaStreams = episode.mediaStreams
        ? JSON.parse(episode.mediaStreams)
        : [];
      const subtitlePaths = episode.subtitlePaths
        ? JSON.parse(episode.subtitlePaths)
        : [];

      return {
        ...episode,
        mediaStreams,
        subtitlePaths,
        show: show
          ? {
              id: show.id,
              title: show.title,
              posterPath: show.posterPath,
              backdropPath: show.backdropPath,
            }
          : null,
        season: season
          ? {
              id: season.id,
              seasonNumber: season.seasonNumber,
              name: season.name,
            }
          : null,
        watchProgress: progress
          ? {
              position: progress.position,
              duration: progress.duration,
              percentage: progress.percentage,
              isWatched: progress.isWatched,
            }
          : null,
      };
    }),

  /**
   * Get the next episode to watch for a show.
   */
  getNextEpisode: protectedProcedure
    .input(z.object({ showId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      // Get all episodes for this show
      const showEpisodes = await ctx.db.query.episodes.findMany({
        where: eq(episodes.showId, input.showId),
        orderBy: [asc(episodes.seasonNumber), asc(episodes.episodeNumber)],
      });

      if (showEpisodes.length === 0) {
        return null;
      }

      // Get watch progress for all episodes
      const episodeIds = showEpisodes.map((e) => e.id);
      const progressRecords = await ctx.db.query.watchProgress.findMany({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'episode'),
          sql`${watchProgress.mediaId} IN (${sql.join(
            episodeIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        ),
      });

      const progressMap = new Map(progressRecords.map((p) => [p.mediaId, p]));

      // Find the first unwatched episode or the first episode with progress < 90%
      for (const episode of showEpisodes) {
        const progress = progressMap.get(episode.id);

        if (!progress) {
          // Never watched, this is the next one
          return episode;
        }

        if (!progress.isWatched && progress.percentage < 90) {
          // In progress, this is the next one
          return {
            ...episode,
            resumePosition: progress.position,
          };
        }
      }

      // All episodes watched, return null or first episode
      return null;
    }),

  /**
   * Get recently added shows.
   */
  recentlyAdded: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      let libraryCondition;
      if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
        const permissions = await ctx.db.query.libraryPermissions.findMany({
          where: and(
            eq(libraryPermissions.userId, ctx.userId),
            eq(libraryPermissions.canView, true)
          ),
        });

        const allowedLibraryIds = permissions.map((p) => p.libraryId);
        if (allowedLibraryIds.length === 0) {
          return [];
        }

        libraryCondition = sql`${tvShows.libraryId} IN (${sql.join(
          allowedLibraryIds.map((id) => sql`${id}`),
          sql`, `
        )})`;
      }

      return ctx.db.query.tvShows.findMany({
        where: libraryCondition,
        orderBy: [desc(tvShows.addedAt)],
        limit: input.limit,
      });
    }),

  /**
   * Get all unique genres across TV shows.
   */
  genres: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .select({ genres: tvShows.genres })
      .from(tvShows)
      .where(sql`${tvShows.genres} IS NOT NULL`);

    const genreSet = new Set<string>();
    for (const row of results) {
      if (row.genres) {
        const parsed = JSON.parse(row.genres) as string[];
        parsed.forEach((g) => genreSet.add(g));
      }
    }

    return Array.from(genreSet).sort();
  }),

  /**
   * Mark an episode as watched.
   */
  markEpisodeWatched: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const episode = await ctx.db.query.episodes.findFirst({
        where: eq(episodes.id, input.id),
      });

      if (!episode) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Episode not found',
        });
      }

      const existing = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'episode'),
          eq(watchProgress.mediaId, input.id)
        ),
      });

      if (existing) {
        await ctx.db
          .update(watchProgress)
          .set({
            isWatched: true,
            percentage: 100,
            watchedAt: new Date().toISOString(),
            playCount: existing.playCount + 1,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(watchProgress.id, existing.id));
      } else {
        const { generateId } = await import('@mediaserver/core');
        await ctx.db.insert(watchProgress).values({
          id: generateId(),
          userId: ctx.userId,
          mediaType: 'episode',
          mediaId: input.id,
          position: episode.duration ?? 0,
          duration: episode.duration ?? 0,
          percentage: 100,
          isWatched: true,
          watchedAt: new Date().toISOString(),
          playCount: 1,
        });
      }

      return { success: true };
    }),

  /**
   * Mark an episode as unwatched.
   */
  markEpisodeUnwatched: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(watchProgress)
        .set({
          isWatched: false,
          position: 0,
          percentage: 0,
          watchedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(watchProgress.userId, ctx.userId),
            eq(watchProgress.mediaType, 'episode'),
            eq(watchProgress.mediaId, input.id)
          )
        );

      return { success: true };
    }),

  /**
   * Mark all episodes in a season as watched.
   */
  markSeasonWatched: protectedProcedure
    .input(
      z.object({
        showId: uuidSchema,
        seasonNumber: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const season = await ctx.db.query.seasons.findFirst({
        where: and(
          eq(seasons.showId, input.showId),
          eq(seasons.seasonNumber, input.seasonNumber)
        ),
      });

      if (!season) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Season not found',
        });
      }

      const seasonEpisodes = await ctx.db.query.episodes.findMany({
        where: eq(episodes.seasonId, season.id),
      });

      const { generateId } = await import('@mediaserver/core');
      const now = new Date().toISOString();

      for (const episode of seasonEpisodes) {
        const existing = await ctx.db.query.watchProgress.findFirst({
          where: and(
            eq(watchProgress.userId, ctx.userId),
            eq(watchProgress.mediaType, 'episode'),
            eq(watchProgress.mediaId, episode.id)
          ),
        });

        if (existing) {
          await ctx.db
            .update(watchProgress)
            .set({
              isWatched: true,
              percentage: 100,
              watchedAt: now,
              playCount: existing.playCount + 1,
              updatedAt: now,
            })
            .where(eq(watchProgress.id, existing.id));
        } else {
          await ctx.db.insert(watchProgress).values({
            id: generateId(),
            userId: ctx.userId,
            mediaType: 'episode',
            mediaId: episode.id,
            position: episode.duration ?? 0,
            duration: episode.duration ?? 0,
            percentage: 100,
            isWatched: true,
            watchedAt: now,
            playCount: 1,
          });
        }
      }

      return { success: true, episodesMarked: seasonEpisodes.length };
    }),
});

