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

/** Provider type */
export type MetadataProvider = 'tmdb' | 'tvdb' | 'anidb' | 'anilist' | 'mal' | 'omdb' | 'trakt';

/**
 * Hook for fetching available metadata providers for a media item.
 * Returns the list of providers that have cached metadata.
 */
export function useAvailableProviders(type: 'movie' | 'show', itemId: string, enabled = true) {
  return trpc.metadata.getAvailableProviders.useQuery(
    { type, itemId },
    { enabled: enabled && !!itemId }
  );
}

/**
 * Hook for fetching metadata from a specific provider.
 * Returns the cached metadata from the provider_metadata table.
 */
export function useProviderMetadata(
  type: 'movie' | 'show',
  itemId: string,
  provider: MetadataProvider,
  enabled = true
) {
  return trpc.metadata.getProviderMetadata.useQuery(
    { type, itemId, provider },
    { enabled: enabled && !!itemId && !!provider }
  );
}

/**
 * Hook for fetching credits from a specific provider.
 */
export function useProviderCredits(
  type: 'movie' | 'show',
  itemId: string,
  provider: MetadataProvider,
  options?: { roleType?: 'cast' | 'crew'; limit?: number },
  enabled = true
) {
  return trpc.metadata.getProviderCredits.useQuery(
    { type, itemId, provider, ...options },
    { enabled: enabled && !!itemId && !!provider }
  );
}


