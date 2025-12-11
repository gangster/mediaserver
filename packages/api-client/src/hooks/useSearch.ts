/**
 * Search-related hooks.
 */

import { trpc } from '../client.js';

/** Search options */
export interface UseSearchOptions {
  query: string;
  type?: 'movie' | 'tvshow' | 'episode';
  limit?: number;
}

/**
 * Hook for global search.
 */
export function useSearch(options: UseSearchOptions, enabled = true) {
  // @ts-expect-error - Router not yet defined
  return trpc.search.search.useQuery(options, { 
    enabled: enabled && options.query.length > 0 
  });
}

/**
 * Hook for search suggestions (autocomplete).
 */
export function useSearchSuggestions(query: string, limit = 5) {
  // @ts-expect-error - Router not yet defined
  return trpc.search.suggestions.useQuery(
    { query, limit },
    { enabled: query.length > 0 }
  );
}

/**
 * Hook for trending/popular items.
 */
export function useTrending(limit = 10) {
  // @ts-expect-error - Router not yet defined
  return trpc.search.trending.useQuery({ limit });
}

