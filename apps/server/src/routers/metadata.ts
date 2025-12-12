/**
 * Metadata router - search, identify, and refresh metadata.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from './trpc.js';
import { idSchema } from '@mediaserver/config';
import { movies, tvShows, eq, and } from '@mediaserver/db';
import {
  getMetadataManager,
  fetchMovieMetadata,
  fetchShowMetadata,
  fetchPendingMovieMetadata,
  fetchPendingShowMetadata,
} from '../services/metadata.js';

export const metadataRouter = router({
  /**
   * Search for metadata matches.
   */
  search: adminProcedure
    .input(
      z.object({
        query: z.string().min(1),
        type: z.enum(['movie', 'tvshow']),
        year: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const manager = getMetadataManager();

      if (input.type === 'movie') {
        return manager.searchMovies(input.query, input.year);
      } else {
        return manager.searchShows(input.query, input.year);
      }
    }),

  /**
   * Identify a media item with a specific external ID.
   */
  identify: adminProcedure
    .input(
      z.object({
        type: z.enum(['movie', 'tvshow']),
        itemId: idSchema,
        integration: z.string(),
        externalId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const manager = getMetadataManager();

      if (input.type === 'movie') {
        // Fetch full details from the integration
        const details = await manager.fetchMovieDetails(input.integration, input.externalId);

        if (!details) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Movie not found in external source',
          });
        }

        // Update movie with metadata
        await ctx.db.update(movies)
          .set({
            tmdbId: details.externalIds.tmdb,
            imdbId: details.externalIds.imdb,
            title: details.title,
            overview: details.overview,
            tagline: details.tagline,
            releaseDate: details.releaseDate,
            runtime: details.runtime,
            voteAverage: details.voteAverage,
            voteCount: details.voteCount,
            posterPath: details.posterPath,
            backdropPath: details.backdropPath,
            matchStatus: 'manual',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(movies.id, input.itemId));

        return { success: true };
      } else {
        // TV show identification
        const details = await manager.fetchShowDetails(input.integration, input.externalId);

        if (!details) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Show not found in external source',
          });
        }

        await ctx.db.update(tvShows)
          .set({
            tmdbId: details.externalIds.tmdb,
            imdbId: details.externalIds.imdb,
            title: details.title,
            overview: details.overview,
            firstAirDate: details.firstAirDate,
            lastAirDate: details.lastAirDate,
            status: details.status,
            network: details.networks?.[0]?.name,
            voteAverage: details.voteAverage,
            voteCount: details.voteCount,
            posterPath: details.posterPath,
            backdropPath: details.backdropPath,
            matchStatus: 'manual',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tvShows.id, input.itemId));

        return { success: true };
      }
    }),

  /**
   * Refresh metadata for a single item.
   */
  refresh: adminProcedure
    .input(
      z.object({
        type: z.enum(['movie', 'tvshow']),
        itemId: idSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Set status to pending first to force re-fetch
      if (input.type === 'movie') {
        await ctx.db.update(movies)
          .set({ matchStatus: 'pending' })
          .where(eq(movies.id, input.itemId));

        return fetchMovieMetadata(ctx.db, input.itemId);
      } else {
        await ctx.db.update(tvShows)
          .set({ matchStatus: 'pending' })
          .where(eq(tvShows.id, input.itemId));

        return fetchShowMetadata(ctx.db, input.itemId);
      }
    }),

  /**
   * Refresh all metadata for a library.
   */
  refreshAll: adminProcedure
    .input(
      z.object({
        libraryId: idSchema.optional(),
        type: z.enum(['movie', 'tv']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Reset all items to pending status
      if (input.type === 'movie' || !input.type) {
        const whereClause = input.libraryId
          ? eq(movies.libraryId, input.libraryId)
          : undefined;

        await ctx.db.update(movies)
          .set({ matchStatus: 'pending' })
          .where(whereClause);
      }

      if (input.type === 'tv' || !input.type) {
        const whereClause = input.libraryId
          ? eq(tvShows.libraryId, input.libraryId)
          : undefined;

        await ctx.db.update(tvShows)
          .set({ matchStatus: 'pending' })
          .where(whereClause);
      }

      // Fetch metadata
      const movieStats = (input.type === 'movie' || !input.type)
        ? await fetchPendingMovieMetadata(ctx.db, input.libraryId)
        : { matched: 0, unmatched: 0, errors: 0 };

      const showStats = (input.type === 'tv' || !input.type)
        ? await fetchPendingShowMetadata(ctx.db, input.libraryId)
        : { matched: 0, unmatched: 0, errors: 0 };

      return {
        movies: movieStats,
        shows: showStats,
      };
    }),

  /**
   * Get unmatched items.
   */
  unmatched: protectedProcedure
    .input(
      z.object({
        libraryId: idSchema.optional(),
        type: z.enum(['movie', 'tvshow']).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const items: Array<{
        id: string;
        type: 'movie' | 'tvshow';
        title: string;
        year: number | null;
        filePath: string;
        posterPath: string | null;
      }> = [];

      // Get unmatched movies
      if (!input.type || input.type === 'movie') {
        const whereClause = input.libraryId
          ? and(
              eq(movies.matchStatus, 'unmatched'),
              eq(movies.libraryId, input.libraryId)
            )
          : eq(movies.matchStatus, 'unmatched');

        const unmatchedMovies = await ctx.db.query.movies.findMany({
          where: whereClause,
          limit: input.limit,
        });

        items.push(
          ...unmatchedMovies.map((m) => ({
            id: m.id,
            type: 'movie' as const,
            title: m.title,
            year: m.year,
            filePath: m.filePath,
            posterPath: m.posterPath,
          }))
        );
      }

      // Get unmatched shows
      if (!input.type || input.type === 'tvshow') {
        const whereClause = input.libraryId
          ? and(
              eq(tvShows.matchStatus, 'unmatched'),
              eq(tvShows.libraryId, input.libraryId)
            )
          : eq(tvShows.matchStatus, 'unmatched');

        const unmatchedShows = await ctx.db.query.tvShows.findMany({
          where: whereClause,
          limit: input.limit,
        });

        items.push(
          ...unmatchedShows.map((s) => ({
            id: s.id,
            type: 'tvshow' as const,
            title: s.title,
            year: s.year,
            filePath: s.folderPath,
            posterPath: s.posterPath,
          }))
        );
      }

      return items;
    }),

  /**
   * Get metadata statistics.
   */
  stats: protectedProcedure
    .input(z.object({ libraryId: idSchema.optional() }))
    .query(async ({ ctx, input }) => {
      const movieWhereBase = input.libraryId
        ? eq(movies.libraryId, input.libraryId)
        : undefined;

      const showWhereBase = input.libraryId
        ? eq(tvShows.libraryId, input.libraryId)
        : undefined;

      // Count movies by status
      const movieMatched = await ctx.db.query.movies.findMany({
        where: movieWhereBase
          ? and(eq(movies.matchStatus, 'matched'), movieWhereBase)
          : eq(movies.matchStatus, 'matched'),
      });

      const movieUnmatched = await ctx.db.query.movies.findMany({
        where: movieWhereBase
          ? and(eq(movies.matchStatus, 'unmatched'), movieWhereBase)
          : eq(movies.matchStatus, 'unmatched'),
      });

      const moviePending = await ctx.db.query.movies.findMany({
        where: movieWhereBase
          ? and(eq(movies.matchStatus, 'pending'), movieWhereBase)
          : eq(movies.matchStatus, 'pending'),
      });

      // Count shows by status
      const showMatched = await ctx.db.query.tvShows.findMany({
        where: showWhereBase
          ? and(eq(tvShows.matchStatus, 'matched'), showWhereBase)
          : eq(tvShows.matchStatus, 'matched'),
      });

      const showUnmatched = await ctx.db.query.tvShows.findMany({
        where: showWhereBase
          ? and(eq(tvShows.matchStatus, 'unmatched'), showWhereBase)
          : eq(tvShows.matchStatus, 'unmatched'),
      });

      const showPending = await ctx.db.query.tvShows.findMany({
        where: showWhereBase
          ? and(eq(tvShows.matchStatus, 'pending'), showWhereBase)
          : eq(tvShows.matchStatus, 'pending'),
      });

      return {
        movies: {
          matched: movieMatched.length,
          unmatched: movieUnmatched.length,
          pending: moviePending.length,
          total: movieMatched.length + movieUnmatched.length + moviePending.length,
        },
        shows: {
          matched: showMatched.length,
          unmatched: showUnmatched.length,
          pending: showPending.length,
          total: showMatched.length + showUnmatched.length + showPending.length,
        },
      };
    }),
});

