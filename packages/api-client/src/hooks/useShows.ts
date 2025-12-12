/**
 * TV show-related hooks.
 */

import { trpc } from '../client.js';

/** Show list options */
export interface UseShowsOptions {
  libraryId?: string;
  genre?: string;
  status?: string;
  sort?: 'addedAt' | 'title' | 'year' | 'rating';
  direction?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
}

/**
 * Hook for fetching a list of TV shows.
 */
export function useShows(options?: UseShowsOptions) {
  return trpc.shows.list.useQuery(options ?? {});
}

/**
 * Hook for infinite show list.
 */
export function useInfiniteShows(options?: Omit<UseShowsOptions, 'cursor'>) {
  return trpc.shows.list.useInfiniteQuery(options ?? {}, {
    getNextPageParam: (lastPage: { nextCursor: string | null }) => lastPage.nextCursor,
  });
}

/**
 * Hook for fetching a single TV show by ID.
 */
export function useShow(id: string, enabled = true) {
  return trpc.shows.get.useQuery({ id }, { enabled });
}

/**
 * Hook for fetching a season with episodes.
 */
export function useSeason(showId: string, seasonNumber: number, enabled = true) {
  return trpc.shows.getSeason.useQuery({ showId, seasonNumber }, { enabled });
}

/**
 * Hook for fetching a single episode.
 */
export function useEpisode(id: string, enabled = true) {
  return trpc.shows.getEpisode.useQuery({ id }, { enabled });
}

/**
 * Hook for fetching the next episode to watch.
 */
export function useNextEpisode(showId: string, enabled = true) {
  return trpc.shows.getNextEpisode.useQuery({ showId }, { enabled });
}

/**
 * Hook for fetching recently added shows.
 */
export function useRecentShows(limit = 10) {
  return trpc.shows.recentlyAdded.useQuery({ limit });
}

/**
 * Hook for fetching show genres.
 */
export function useShowGenres() {
  return trpc.shows.genres.useQuery();
}

/**
 * Hook for marking an episode as watched.
 */
export function useMarkEpisodeWatched() {
  return trpc.shows.markEpisodeWatched.useMutation();
}

/**
 * Hook for marking an episode as unwatched.
 */
export function useMarkEpisodeUnwatched() {
  return trpc.shows.markEpisodeUnwatched.useMutation();
}

/**
 * Hook for marking a whole season as watched.
 */
export function useMarkSeasonWatched() {
  return trpc.shows.markSeasonWatched.useMutation();
}

