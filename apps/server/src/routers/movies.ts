/**
 * Movies router - list, get, and metadata operations.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from './trpc.js';
import { moviesListInputSchema, uuidSchema } from '@mediaserver/config';
import {
  movies,
  watchProgress,
  libraryPermissions,
  eq,
  and,
  desc,
  asc,
  like,
  sql,
} from '@mediaserver/db';

export const moviesRouter = router({
  /**
   * List movies with pagination, sorting, and filtering.
   */
  list: protectedProcedure.input(moviesListInputSchema).query(async ({ ctx, input }) => {
    const { libraryId, genre, year, sort, direction, limit, cursor } = input;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (libraryId) {
      conditions.push(eq(movies.libraryId, libraryId));
    }

    if (genre) {
      // Genres are stored as JSON array, search within
      conditions.push(like(movies.genres, `%"${genre}"%`));
    }

    if (year) {
      conditions.push(eq(movies.year, year));
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
        sql`${movies.libraryId} IN (${sql.join(
          allowedLibraryIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
    }

    // Build order by
    const orderFn = direction === 'desc' ? desc : asc;
    const orderColumn = {
      addedAt: movies.addedAt,
      title: movies.sortTitle,
      year: movies.year,
      rating: movies.voteAverage,
    }[sort];

    // Handle cursor pagination
    if (cursor) {
      // Cursor is the ID of the last item
      const cursorMovie = await ctx.db.query.movies.findFirst({
        where: eq(movies.id, cursor),
      });

      if (cursorMovie) {
        // Add condition to get items after cursor
        if (sort === 'addedAt') {
          const comparison = direction === 'desc' ? sql`<` : sql`>`;
          conditions.push(
            sql`${movies.addedAt} ${comparison} ${cursorMovie.addedAt}`
          );
        }
      }
    }

    // Execute query
    const results = await ctx.db.query.movies.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: orderColumn ? [orderFn(orderColumn)] : [desc(movies.addedAt)],
      limit: limit + 1, // Fetch one extra to determine if there's a next page
    });

    // Get total count (for stats display)
    const countResult = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(movies)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = countResult[0]?.count ?? 0;

    // Determine next cursor
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
   * Get a single movie by ID.
   */
  get: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const movie = await ctx.db.query.movies.findFirst({
        where: eq(movies.id, input.id),
      });

      if (!movie) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Movie not found',
        });
      }

      // Check library permission for non-admin users
      if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
        const permission = await ctx.db.query.libraryPermissions.findFirst({
          where: and(
            eq(libraryPermissions.userId, ctx.userId),
            eq(libraryPermissions.libraryId, movie.libraryId),
            eq(libraryPermissions.canView, true)
          ),
        });

        if (!permission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this movie',
          });
        }
      }

      // Get watch progress for this user
      const progress = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'movie'),
          eq(watchProgress.mediaId, input.id)
        ),
      });

      // Parse JSON fields
      const genres = movie.genres ? JSON.parse(movie.genres) : [];
      const mediaStreams = movie.mediaStreams ? JSON.parse(movie.mediaStreams) : [];
      const subtitlePaths = movie.subtitlePaths ? JSON.parse(movie.subtitlePaths) : [];

      return {
        ...movie,
        genres,
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
    }),

  /**
   * Get recently added movies.
   */
  recentlyAdded: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      // For non-admin users, filter by library permissions
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

        libraryCondition = sql`${movies.libraryId} IN (${sql.join(
          allowedLibraryIds.map((id) => sql`${id}`),
          sql`, `
        )})`;
      }

      return ctx.db.query.movies.findMany({
        where: libraryCondition,
        orderBy: [desc(movies.addedAt)],
        limit: input.limit,
      });
    }),

  /**
   * Get all unique genres across movies.
   */
  genres: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .select({ genres: movies.genres })
      .from(movies)
      .where(sql`${movies.genres} IS NOT NULL`);

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
   * Get all unique years across movies.
   */
  years: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .selectDistinct({ year: movies.year })
      .from(movies)
      .where(sql`${movies.year} IS NOT NULL`)
      .orderBy(desc(movies.year));

    return results.map((r) => r.year).filter((y): y is number => y !== null);
  }),

  /**
   * Update movie metadata manually.
   */
  updateMetadata: adminProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: z.object({
          title: z.string().optional(),
          sortTitle: z.string().optional(),
          overview: z.string().optional(),
          year: z.number().int().min(1888).max(2100).optional(),
          genres: z.array(z.string()).optional(),
          contentRating: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const movie = await ctx.db.query.movies.findFirst({
        where: eq(movies.id, input.id),
      });

      if (!movie) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Movie not found',
        });
      }

      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
        matchStatus: 'manual',
      };

      if (input.data.title !== undefined) {
        updateData['title'] = input.data.title;
      }
      if (input.data.sortTitle !== undefined) {
        updateData['sortTitle'] = input.data.sortTitle;
      }
      if (input.data.overview !== undefined) {
        updateData['overview'] = input.data.overview;
      }
      if (input.data.year !== undefined) {
        updateData['year'] = input.data.year;
      }
      if (input.data.genres !== undefined) {
        updateData['genres'] = JSON.stringify(input.data.genres);
      }
      if (input.data.contentRating !== undefined) {
        updateData['contentRating'] = input.data.contentRating;
      }

      await ctx.db.update(movies).set(updateData).where(eq(movies.id, input.id));

      return ctx.db.query.movies.findFirst({
        where: eq(movies.id, input.id),
      });
    }),

  /**
   * Mark a movie as watched.
   */
  markWatched: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const movie = await ctx.db.query.movies.findFirst({
        where: eq(movies.id, input.id),
      });

      if (!movie) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Movie not found',
        });
      }

      // Upsert watch progress
      const existing = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'movie'),
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
          mediaType: 'movie',
          mediaId: input.id,
          position: movie.duration ?? 0,
          duration: movie.duration ?? 0,
          percentage: 100,
          isWatched: true,
          watchedAt: new Date().toISOString(),
          playCount: 1,
        });
      }

      return { success: true };
    }),

  /**
   * Mark a movie as unwatched.
   */
  markUnwatched: protectedProcedure
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
            eq(watchProgress.mediaType, 'movie'),
            eq(watchProgress.mediaId, input.id)
          )
        );

      return { success: true };
    }),
});

