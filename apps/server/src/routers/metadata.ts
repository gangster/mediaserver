/**
 * Metadata router - search, identify, and refresh metadata.
 * 
 * Supports multi-provider architecture where metadata from all configured
 * providers is cached, enabling instant provider switching in the UI.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from './trpc.js';
import { idSchema } from '@mediaserver/config';
import { movies, tvShows, libraries, providerMetadata, providerCredits, eq, and } from '@mediaserver/db';
import { getMetadataManager } from '../services/metadata.js';
import { getJobQueue } from '../jobs/init.js';
import { QUEUE_NAMES } from '../jobs/types.js';

/** Valid metadata provider IDs */
const providerSchema = z.enum(['tmdb', 'tvdb', 'anidb', 'anilist', 'mal', 'omdb', 'trakt']);

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
   * Creates a job that will be processed in the background.
   */
  refresh: adminProcedure
    .input(
      z.object({
        type: z.enum(['movie', 'tvshow']),
        itemId: idSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const queue = getJobQueue();

      if (input.type === 'movie') {
        // Get movie details for the job
        const movie = await ctx.db.query.movies.findFirst({
          where: eq(movies.id, input.itemId),
        });

        if (!movie) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Movie not found' });
        }

        // Set status to pending
        await ctx.db.update(movies)
          .set({ matchStatus: 'pending' })
          .where(eq(movies.id, input.itemId));

        // Add job to queue
        const jobId = await queue.addJob(QUEUE_NAMES.METADATA, {
          type: 'refresh_movie',
          movieId: input.itemId,
          movieTitle: movie.title,
          force: true,
        });

        return { jobId, queued: true };
      } else {
        // Get show details for the job
        const show = await ctx.db.query.tvShows.findFirst({
          where: eq(tvShows.id, input.itemId),
        });

        if (!show) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Show not found' });
        }

        // Set status to pending
        await ctx.db.update(tvShows)
          .set({ matchStatus: 'pending' })
          .where(eq(tvShows.id, input.itemId));

        // Add job to queue
        const jobId = await queue.addJob(QUEUE_NAMES.METADATA, {
          type: 'refresh_show',
          showId: input.itemId,
          showTitle: show.title,
          force: true,
        });

        return { jobId, queued: true };
      }
    }),

  /**
   * Refresh all metadata for a library.
   * Creates a job that will be processed in the background.
   */
  refreshAll: adminProcedure
    .input(
      z.object({
        libraryId: idSchema.optional(),
        type: z.enum(['movie', 'tv']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const queue = getJobQueue();
      const jobIds: string[] = [];

      // If a specific library is provided, create a library refresh job
      if (input.libraryId) {
        const library = await ctx.db.query.libraries.findFirst({
          where: eq(libraries.id, input.libraryId),
        });

        if (!library) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Library not found' });
        }

        const jobId = await queue.addJob(QUEUE_NAMES.METADATA, {
          type: 'refresh_library',
          libraryId: input.libraryId,
          libraryName: library.name,
          force: true,
        });

        return { jobIds: [jobId], queued: true, count: 1 };
      }

      // Otherwise, create jobs for all libraries
      const allLibraries = await ctx.db.query.libraries.findMany();

      for (const library of allLibraries) {
        // Filter by type if specified
        if (input.type && library.type !== input.type) continue;

        const jobId = await queue.addJob(QUEUE_NAMES.METADATA, {
          type: 'refresh_library',
          libraryId: library.id,
          libraryName: library.name,
          force: true,
        });

        jobIds.push(jobId);
      }

      return { jobIds, queued: true, count: jobIds.length };
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
   * Get cached metadata for a specific provider.
   * 
   * Returns the pre-cached metadata from the provider_metadata table,
   * enabling instant provider switching without API calls.
   */
  getProviderMetadata: protectedProcedure
    .input(
      z.object({
        type: z.enum(['movie', 'show']),
        itemId: idSchema,
        provider: providerSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const metadata = await ctx.db.query.providerMetadata.findFirst({
        where: and(
          eq(providerMetadata.mediaType, input.type),
          eq(providerMetadata.mediaId, input.itemId),
          eq(providerMetadata.provider, input.provider)
        ),
      });

      if (!metadata) {
        return null;
      }

      // Parse JSON fields
      return {
        ...metadata,
        genres: metadata.genres ? JSON.parse(metadata.genres) : [],
        contentRatings: metadata.contentRatings ? JSON.parse(metadata.contentRatings) : [],
        networks: metadata.networks ? JSON.parse(metadata.networks) : [],
        productionCompanies: metadata.productionCompanies ? JSON.parse(metadata.productionCompanies) : [],
        trailers: metadata.trailers ? JSON.parse(metadata.trailers) : [],
        seasons: metadata.seasons ? JSON.parse(metadata.seasons) : [],
        productionCountries: metadata.productionCountries ? JSON.parse(metadata.productionCountries) : [],
        spokenLanguages: metadata.spokenLanguages ? JSON.parse(metadata.spokenLanguages) : [],
        originCountry: metadata.originCountry ? JSON.parse(metadata.originCountry) : [],
      };
    }),

  /**
   * Get all available providers for a media item.
   * 
   * Returns a list of providers that have cached metadata for this item.
   */
  getAvailableProviders: protectedProcedure
    .input(
      z.object({
        type: z.enum(['movie', 'show']),
        itemId: idSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const metadata = await ctx.db.query.providerMetadata.findMany({
        where: and(
          eq(providerMetadata.mediaType, input.type),
          eq(providerMetadata.mediaId, input.itemId)
        ),
        columns: {
          provider: true,
          title: true,
          fetchedAt: true,
        },
      });

      return metadata.map((m) => ({
        provider: m.provider,
        title: m.title,
        fetchedAt: m.fetchedAt,
      }));
    }),

  /**
   * Get credits from a specific provider.
   */
  getProviderCredits: protectedProcedure
    .input(
      z.object({
        type: z.enum(['movie', 'show']),
        itemId: idSchema,
        provider: providerSchema,
        roleType: z.enum(['cast', 'crew']).optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const whereConditions = [
        eq(providerCredits.mediaType, input.type),
        eq(providerCredits.mediaId, input.itemId),
        eq(providerCredits.provider, input.provider),
      ];

      if (input.roleType) {
        whereConditions.push(eq(providerCredits.roleType, input.roleType));
      }

      const credits = await ctx.db.query.providerCredits.findMany({
        where: and(...whereConditions),
        limit: input.limit,
        orderBy: (credits, { asc }) => [asc(credits.creditOrder)],
      });

      return credits;
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


