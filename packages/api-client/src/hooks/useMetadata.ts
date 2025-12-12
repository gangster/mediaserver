/**
 * Metadata-related hooks for search, identify, and refresh operations.
 */

import { trpc } from '../client.js';

/** Search metadata options */
export interface UseMetadataSearchOptions {
  query: string;
  type: 'movie' | 'tvshow';
  year?: number;
}

/**
 * Hook for searching metadata sources.
 */
export function useMetadataSearch(options: UseMetadataSearchOptions, enabled = true) {
  return trpc.metadata.search.useQuery(options, { enabled: enabled && options.query.length > 0 });
}

/**
 * Hook for identifying a media item with external metadata.
 */
export function useIdentifyMedia() {
  return trpc.metadata.identify.useMutation();
}

/**
 * Hook for refreshing metadata for a single item.
 */
export function useRefreshMetadata() {
  return trpc.metadata.refresh.useMutation();
}

/**
 * Hook for refreshing all metadata in a library.
 */
export function useRefreshAllMetadata() {
  return trpc.metadata.refreshAll.useMutation();
}

/** Unmatched items options */
export interface UseUnmatchedOptions {
  libraryId?: string;
  type?: 'movie' | 'tvshow';
  limit?: number;
}

/**
 * Hook for fetching unmatched items.
 */
export function useUnmatchedItems(options?: UseUnmatchedOptions) {
  return trpc.metadata.unmatched.useQuery(options ?? {});
}

/**
 * Hook for fetching metadata statistics.
 */
export function useMetadataStats(libraryId?: string) {
  return trpc.metadata.stats.useQuery({ libraryId });
}

