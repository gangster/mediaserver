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
  useMovieFileStats,
  useMovieCredits,
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
  useShowCredits,
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
  useSessionSeek,
  useTranscodedProgress,
  useContinueWatching,
  useRecentlyWatched,
  useActiveSessions,
} from './usePlayback.js';

// Playback session hook (comprehensive session lifecycle management)
export { usePlaybackSession } from './usePlaybackSession.js';
export type {
  SessionStatus,
  CreateSessionResponse,
  SeekResult,
  UsePlaybackSessionOptions,
  UsePlaybackSessionReturn,
} from './usePlaybackSession.js';

// Player controls hook (state management for video player)
export { usePlayerControls } from './usePlayerControls.js';
export type {
  PlayerStatus,
  BufferedRange,
  QualityLevel,
  PlayerError,
  PlayerState,
  UsePlayerControlsOptions,
  PlayerHandle,
  UsePlayerControlsReturn,
} from './usePlayerControls.js';

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

// Metadata hooks
export {
  useMetadataSearch,
  useIdentifyMedia,
  useRefreshMetadata,
  useRefreshAllMetadata,
  useUnmatchedItems,
  useMetadataStats,
  useAvailableProviders,
  useProviderMetadata,
  useProviderCredits,
} from './useMetadata.js';
export type { UseMetadataSearchOptions, UseUnmatchedOptions, MetadataProvider } from './useMetadata.js';

// Integration hooks
export {
  useIntegrations,
  useIntegration,
  useUpdateIntegration,
  useTestIntegrationConnection,
  useRatingSources,
  useUpdateRatingSources,
  usePrimaryProviders,
  useUpdatePrimaryProviders,
  useGetOAuthUrl,
  useHandleOAuthCallback,
  useDisconnectOAuth,
  useOAuthStatus,
} from './useIntegrations.js';

// Job hooks
export {
  useJobs,
  useJob,
  useActiveJobs,
  useJobStats,
  useCancelJob,
  useRetryJob,
  useRemoveJob,
  useClearCompletedJobs,
  usePauseQueue,
  useResumeQueue,
} from './useJobs.js';

// Subtitle hooks (track retrieval only)
export {
  useMovieSubtitles,
  useEpisodeSubtitles,
  useAvailableSubtitleLanguages,
} from './useSubtitles.js';
export type { SubtitleTrack, LanguageOption, AvailableLanguage } from './useSubtitles.js';

// Audio hooks
export {
  useMovieAudioTracks,
  useEpisodeAudioTracks,
  useAvailableAudioLanguages,
} from './useAudio.js';
export type { AudioTrack } from './useAudio.js';

// Playback preferences hooks (unified audio + subtitle preferences)
export {
  usePlaybackPreferences,
  useUpdatePlaybackPreferences,
  useLanguageRules,
  useCreateLanguageRule,
  useUpdateLanguageRule,
  useDeleteLanguageRule,
  useToggleLanguageRule,
  useMediaLanguageOverride,
  useSetMediaLanguageOverride,
  useClearMediaLanguageOverride,
  useSessionState,
  useUpdateSessionState,
  useClearSessionState,
  useTrackSelection,
} from './usePlaybackPreferences.js';
export type {
  SubtitleMode,
  AudioQualityPreference,
  PlaybackPreferences,
  LanguageRuleConditions,
  LanguageRule,
  MediaLanguageOverride,
  SessionState,
  TrackSelectionResult,
} from './usePlaybackPreferences.js';

