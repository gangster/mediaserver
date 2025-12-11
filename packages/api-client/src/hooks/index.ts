/**
 * Hook exports.
 *
 * Note: These hooks use @ts-expect-error comments because the
 * AppRouter type from the server package is not yet available.
 * Once the server is built, import the AppRouter type and
 * update the client.ts file.
 */

// Auth hooks
export { useLogin, useRegister, useLogout, useRefreshToken, useCurrentUser } from './useAuth.js';

// Movie hooks
export {
  useMovies,
  useInfiniteMovies,
  useMovie,
  useRecentMovies,
  useMovieGenres,
  useMovieYears,
  useMarkMovieWatched,
  useMarkMovieUnwatched,
} from './useMovies.js';
export type { UseMoviesOptions } from './useMovies.js';

// Show hooks
export {
  useShows,
  useInfiniteShows,
  useShow,
  useSeason,
  useEpisode,
  useNextEpisode,
  useRecentShows,
  useShowGenres,
  useMarkEpisodeWatched,
  useMarkEpisodeUnwatched,
  useMarkSeasonWatched,
} from './useShows.js';
export type { UseShowsOptions } from './useShows.js';

// Library hooks
export {
  useCheckPath,
  useCreatePath,
  useLibraryUtils,
  useLibraries,
  useLibrary,
  useLibraryStats,
  useCreateLibrary,
  useUpdateLibrary,
  useDeleteLibrary,
  useScanLibrary,
  useLibraryScanStatus,
  useGrantLibraryPermission,
  useRevokeLibraryPermission,
  useLibraryPermissions,
} from './useLibraries.js';

// Playback hooks
export {
  useWatchProgress,
  useUpdateProgress,
  useCreateSession,
  useSessionHeartbeat,
  useEndSession,
  useContinueWatching,
  useRecentlyWatched,
  useActiveSessions,
} from './usePlayback.js';

// Search hooks
export { useSearch, useSearchSuggestions, useTrending } from './useSearch.js';
export type { UseSearchOptions } from './useSearch.js';

// Settings hooks
export {
  usePrivacySettings,
  useUpdatePrivacySettings,
  useLicense,
  useActivateLicense,
  useRemoteAccessConfig,
  useUpdateRemoteAccessConfig,
  useProviderConfigs,
  useUpdateProviderConfig,
  useServerStats,
} from './useSettings.js';

// Setup hooks
export {
  useSetupStatus,
  useCreateOwner,
  useSetupAddLibrary,
  useMetadataProviders,
  useSaveMetadataProviders,
  useSavePrivacySettings,
  useCompleteSetup,
} from './useSetup.js';

