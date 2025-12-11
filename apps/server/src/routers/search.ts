/**
 * Search router - global search across movies, shows, episodes.
 */

import { z } from 'zod';
import { router, protectedProcedure } from './trpc.js';
import { searchInputSchema } from '@mediaserver/config';
import {
  movies,
  tvShows,
  episodes,
  libraryPermissions,
  eq,
  and,
  or,
  like,
  sql,
  desc,
} from '@mediaserver/db';

/** Search result types */
interface MovieSearchResult {
  type: 'movie';
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  voteAverage: number | null;
}

interface ShowSearchResult {
  type: 'tvshow';
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  voteAverage: number | null;
  seasonCount: number;
  episodeCount: number;
}

interface EpisodeSearchResult {
  type: 'episode';
  id: string;
  title: string | null;
  showId: string;
  showTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  stillPath: string | null;
  overview: string | null;
}

type SearchResult = MovieSearchResult | ShowSearchResult | EpisodeSearchResult;

export const searchRouter = router({
  /**
   * Global search across all media types.
   */
  search: protectedProcedure.input(searchInputSchema).query(async ({ ctx, input }) => {
    const { query, type, limit } = input;

    // Escape special characters for LIKE query
    const searchPattern = `%${query.replace(/[%_]/g, '\\$&')}%`;

    // Get allowed library IDs for non-admin users
    let allowedLibraryIds: string[] | null = null;
    if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
      const permissions = await ctx.db.query.libraryPermissions.findMany({
        where: and(
          eq(libraryPermissions.userId, ctx.userId),
          eq(libraryPermissions.canView, true)
        ),
      });
      allowedLibraryIds = permissions.map((p) => p.libraryId);

      if (allowedLibraryIds.length === 0) {
        return { movies: [], shows: [], episodes: [] };
      }
    }

    const results: {
      movies: MovieSearchResult[];
      shows: ShowSearchResult[];
      episodes: EpisodeSearchResult[];
    } = {
      movies: [],
      shows: [],
      episodes: [],
    };

    // Search movies
    if (!type || type === 'movie') {
      const movieConditions = [
        or(
          like(movies.title, searchPattern),
          like(movies.sortTitle, searchPattern),
          like(movies.overview, searchPattern)
        ),
      ];

      if (allowedLibraryIds) {
        movieConditions.push(
          sql`${movies.libraryId} IN (${sql.join(
            allowedLibraryIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );
      }

      const movieResults = await ctx.db
        .select({
          id: movies.id,
          title: movies.title,
          year: movies.year,
          posterPath: movies.posterPath,
          backdropPath: movies.backdropPath,
          overview: movies.overview,
          voteAverage: movies.voteAverage,
        })
        .from(movies)
        .where(and(...movieConditions))
        .orderBy(desc(movies.voteAverage))
        .limit(limit);

      results.movies = movieResults.map((m) => ({
        type: 'movie' as const,
        ...m,
      }));
    }

    // Search TV shows
    if (!type || type === 'tvshow') {
      const showConditions = [
        or(
          like(tvShows.title, searchPattern),
          like(tvShows.sortTitle, searchPattern),
          like(tvShows.overview, searchPattern)
        ),
      ];

      if (allowedLibraryIds) {
        showConditions.push(
          sql`${tvShows.libraryId} IN (${sql.join(
            allowedLibraryIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );
      }

      const showResults = await ctx.db
        .select({
          id: tvShows.id,
          title: tvShows.title,
          year: tvShows.year,
          posterPath: tvShows.posterPath,
          backdropPath: tvShows.backdropPath,
          overview: tvShows.overview,
          voteAverage: tvShows.voteAverage,
          seasonCount: tvShows.seasonCount,
          episodeCount: tvShows.episodeCount,
        })
        .from(tvShows)
        .where(and(...showConditions))
        .orderBy(desc(tvShows.voteAverage))
        .limit(limit);

      results.shows = showResults.map((s) => ({
        type: 'tvshow' as const,
        ...s,
      }));
    }

    // Search episodes
    if (!type || type === 'episode') {
      // First get allowed show IDs
      let showCondition;
      if (allowedLibraryIds) {
        const allowedShows = await ctx.db
          .select({ id: tvShows.id })
          .from(tvShows)
          .where(
            sql`${tvShows.libraryId} IN (${sql.join(
              allowedLibraryIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          );

        const showIds = allowedShows.map((s) => s.id);
        if (showIds.length === 0) {
          results.episodes = [];
        } else {
          showCondition = sql`${episodes.showId} IN (${sql.join(
            showIds.map((id) => sql`${id}`),
            sql`, `
          )})`;
        }
      }

      if (!allowedLibraryIds || (allowedLibraryIds && results.episodes.length === 0)) {
        const episodeConditions = [
          or(
            like(episodes.title, searchPattern),
            like(episodes.overview, searchPattern)
          ),
        ];

        if (showCondition) {
          episodeConditions.push(showCondition);
        }

        const episodeResults = await ctx.db
          .select({
            id: episodes.id,
            title: episodes.title,
            showId: episodes.showId,
            seasonNumber: episodes.seasonNumber,
            episodeNumber: episodes.episodeNumber,
            stillPath: episodes.stillPath,
            overview: episodes.overview,
          })
          .from(episodes)
          .where(and(...episodeConditions))
          .limit(limit);

        // Get show titles for episodes
        const showIds = [...new Set(episodeResults.map((e) => e.showId))];
        const showTitles = new Map<string, string>();

        if (showIds.length > 0) {
          const shows = await ctx.db
            .select({ id: tvShows.id, title: tvShows.title })
            .from(tvShows)
            .where(
              sql`${tvShows.id} IN (${sql.join(
                showIds.map((id) => sql`${id}`),
                sql`, `
              )})`
            );

          shows.forEach((s) => showTitles.set(s.id, s.title));
        }

        results.episodes = episodeResults.map((e) => ({
          type: 'episode' as const,
          ...e,
          showTitle: showTitles.get(e.showId) ?? 'Unknown Show',
        }));
      }
    }

    return results;
  }),

  /**
   * Get search suggestions (for autocomplete).
   */
  suggestions: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(10).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const { query, limit } = input;
      const searchPattern = `%${query.replace(/[%_]/g, '\\$&')}%`;

      // Get movie titles
      const movieTitles = await ctx.db
        .select({ title: movies.title })
        .from(movies)
        .where(like(movies.title, searchPattern))
        .limit(limit);

      // Get show titles
      const showTitles = await ctx.db
        .select({ title: tvShows.title })
        .from(tvShows)
        .where(like(tvShows.title, searchPattern))
        .limit(limit);

      // Combine and dedupe
      const suggestions = [
        ...new Set([
          ...movieTitles.map((m) => m.title),
          ...showTitles.map((s) => s.title),
        ]),
      ].slice(0, limit);

      return suggestions;
    }),

  /**
   * Get trending/popular items (for empty search state).
   */
  trending: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(10) }))
    .query(async ({ ctx, input }) => {
      // Get highest rated movies
      const topMovies = await ctx.db
        .select({
          id: movies.id,
          title: movies.title,
          posterPath: movies.posterPath,
          year: movies.year,
          voteAverage: movies.voteAverage,
        })
        .from(movies)
        .where(sql`${movies.voteAverage} IS NOT NULL`)
        .orderBy(desc(movies.voteAverage))
        .limit(input.limit);

      // Get highest rated shows
      const topShows = await ctx.db
        .select({
          id: tvShows.id,
          title: tvShows.title,
          posterPath: tvShows.posterPath,
          year: tvShows.year,
          voteAverage: tvShows.voteAverage,
        })
        .from(tvShows)
        .where(sql`${tvShows.voteAverage} IS NOT NULL`)
        .orderBy(desc(tvShows.voteAverage))
        .limit(input.limit);

      return {
        movies: topMovies.map((m) => ({ type: 'movie' as const, ...m })),
        shows: topShows.map((s) => ({ type: 'tvshow' as const, ...s })),
      };
    }),
});

