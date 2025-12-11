/**
 * Movie-related hooks.
 */

import { trpc } from '../client.js';

/** Movie list options */
export interface UseMoviesOptions {
  libraryId?: string;
  genre?: string;
  year?: number;
  sort?: 'addedAt' | 'title' | 'year' | 'rating';
  direction?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
}

/**
 * Hook for fetching a list of movies.
 */
export function useMovies(options?: UseMoviesOptions) {
  // @ts-expect-error - Router not yet defined
  return trpc.movies.list.useQuery(options ?? {});
}

/**
 * Hook for infinite movie list.
 */
export function useInfiniteMovies(options?: Omit<UseMoviesOptions, 'cursor'>) {
  // @ts-expect-error - Router not yet defined
  return trpc.movies.list.useInfiniteQuery(options ?? {}, {
    getNextPageParam: (lastPage: { nextCursor: string | null }) => lastPage.nextCursor,
  });
}

/**
 * Hook for fetching a single movie by ID.
 */
export function useMovie(id: string, enabled = true) {
  // @ts-expect-error - Router not yet defined
  return trpc.movies.get.useQuery({ id }, { enabled });
}

/**
 * Hook for fetching recently added movies.
 */
export function useRecentMovies(limit = 10) {
  // @ts-expect-error - Router not yet defined
  return trpc.movies.recentlyAdded.useQuery({ limit });
}

/**
 * Hook for fetching movie genres.
 */
export function useMovieGenres() {
  // @ts-expect-error - Router not yet defined
  return trpc.movies.genres.useQuery();
}

/**
 * Hook for fetching movie years.
 */
export function useMovieYears() {
  // @ts-expect-error - Router not yet defined
  return trpc.movies.years.useQuery();
}

/**
 * Hook for marking a movie as watched.
 */
export function useMarkMovieWatched() {
  // @ts-expect-error - Router not yet defined
  return trpc.movies.markWatched.useMutation();
}

/**
 * Hook for marking a movie as unwatched.
 */
export function useMarkMovieUnwatched() {
  // @ts-expect-error - Router not yet defined
  return trpc.movies.markUnwatched.useMutation();
}

