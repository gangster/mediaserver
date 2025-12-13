/**
 * Playback preferences hooks.
 *
 * Provides hooks for managing unified audio and subtitle preferences,
 * language rules, per-media overrides, and session state.
 */

import { trpc } from '../client.js';

// =============================================================================
// Types
// =============================================================================

export type SubtitleMode = 'off' | 'auto' | 'always' | 'foreign_only';
export type AudioQualityPreference = 'highest' | 'balanced' | 'compatible';

export interface PlaybackPreferences {
  audioLanguages: string[];
  subtitleLanguages: string[];
  subtitleMode: SubtitleMode;
  alwaysShowForced: boolean;
  preferSdh: boolean;
  preferOriginalAudio: boolean;
  audioQuality: AudioQualityPreference;
  rememberWithinSession: boolean;
}

export interface LanguageRuleConditions {
  genres?: string[];
  originCountries?: string[];
  originalLanguages?: string[];
  libraryIds?: string[];
  keywords?: string[];
}

export interface LanguageRule {
  id: string;
  name: string;
  priority: number;
  isBuiltIn: boolean;
  enabled: boolean;
  conditions: LanguageRuleConditions;
  audioLanguages: string[];
  subtitleLanguages: string[];
  subtitleMode?: SubtitleMode | null;
}

export interface MediaLanguageOverride {
  audioLanguages: string[] | null;
  subtitleLanguages: string[] | null;
  subtitleMode: SubtitleMode | null;
}

export interface SessionState {
  lastAudioLanguage: string | null;
  lastSubtitleLanguage: string | null;
  wasExplicitChange: boolean;
}

// =============================================================================
// Global Preferences Hooks
// =============================================================================

/**
 * Get user's global playback preferences.
 */
export function usePlaybackPreferences(enabled = true) {
  return trpc.playbackPreferences.getPreferences.useQuery(undefined, { enabled });
}

/**
 * Update user's global playback preferences.
 */
export function useUpdatePlaybackPreferences() {
  const utils = trpc.useUtils();

  return trpc.playbackPreferences.updatePreferences.useMutation({
    onSuccess: () => {
      utils.playbackPreferences.getPreferences.invalidate();
    },
  });
}

// =============================================================================
// Language Rules Hooks
// =============================================================================

/**
 * Get all language rules for the user.
 */
export function useLanguageRules(enabled = true) {
  return trpc.playbackPreferences.getRules.useQuery(undefined, { enabled });
}

/**
 * Create a new language rule.
 */
export function useCreateLanguageRule() {
  const utils = trpc.useUtils();

  return trpc.playbackPreferences.createRule.useMutation({
    onSuccess: () => {
      utils.playbackPreferences.getRules.invalidate();
    },
  });
}

/**
 * Update an existing language rule.
 */
export function useUpdateLanguageRule() {
  const utils = trpc.useUtils();

  return trpc.playbackPreferences.updateRule.useMutation({
    onSuccess: () => {
      utils.playbackPreferences.getRules.invalidate();
    },
  });
}

/**
 * Delete a language rule.
 */
export function useDeleteLanguageRule() {
  const utils = trpc.useUtils();

  return trpc.playbackPreferences.deleteRule.useMutation({
    onSuccess: () => {
      utils.playbackPreferences.getRules.invalidate();
    },
  });
}

/**
 * Toggle a rule's enabled state.
 */
export function useToggleLanguageRule() {
  const utils = trpc.useUtils();

  return trpc.playbackPreferences.toggleRule.useMutation({
    onSuccess: () => {
      utils.playbackPreferences.getRules.invalidate();
    },
  });
}

// =============================================================================
// Media Override Hooks
// =============================================================================

/**
 * Get override for a specific media item.
 */
export function useMediaLanguageOverride(
  mediaType: 'movie' | 'show',
  mediaId: string,
  enabled = true
) {
  return trpc.playbackPreferences.getOverride.useQuery(
    { mediaType, mediaId },
    { enabled: enabled && !!mediaId }
  );
}

/**
 * Set override for a specific media item.
 */
export function useSetMediaLanguageOverride() {
  const utils = trpc.useUtils();

  return trpc.playbackPreferences.setOverride.useMutation({
    onSuccess: (
      _: unknown,
      variables: { mediaType: 'movie' | 'show'; mediaId: string }
    ) => {
      utils.playbackPreferences.getOverride.invalidate({
        mediaType: variables.mediaType,
        mediaId: variables.mediaId,
      });
    },
  });
}

/**
 * Clear override for a specific media item.
 */
export function useClearMediaLanguageOverride() {
  const utils = trpc.useUtils();

  return trpc.playbackPreferences.clearOverride.useMutation({
    onSuccess: (
      _: unknown,
      variables: { mediaType: 'movie' | 'show'; mediaId: string }
    ) => {
      utils.playbackPreferences.getOverride.invalidate({
        mediaType: variables.mediaType,
        mediaId: variables.mediaId,
      });
    },
  });
}

// =============================================================================
// Session State Hooks
// =============================================================================

/**
 * Get session state for a show (for binge-watching continuity).
 */
export function useSessionState(showId: string, enabled = true) {
  return trpc.playbackPreferences.getSessionState.useQuery(
    { showId },
    { enabled: enabled && !!showId }
  );
}

/**
 * Update session state after track selection.
 */
export function useUpdateSessionState() {
  const utils = trpc.useUtils();

  return trpc.playbackPreferences.updateSessionState.useMutation({
    onSuccess: (_: unknown, variables: { showId: string }) => {
      utils.playbackPreferences.getSessionState.invalidate({
        showId: variables.showId,
      });
    },
  });
}

/**
 * Clear session state for a show.
 */
export function useClearSessionState() {
  const utils = trpc.useUtils();

  return trpc.playbackPreferences.clearSessionState.useMutation({
    onSuccess: (_: unknown, variables: { showId: string }) => {
      utils.playbackPreferences.getSessionState.invalidate({
        showId: variables.showId,
      });
    },
  });
}

// =============================================================================
// Track Selection Hook
// =============================================================================

export interface TrackSelectionResult {
  audioTrackId: string | null;
  subtitleTrackId: string | null;
  forcedSubtitleTrackId: string | null;
  audioMismatch: boolean;
  subtitleMismatch: boolean;
  audioLanguageUsed: string | null;
  subtitleLanguageUsed: string | null;
}

/**
 * Select the best audio and subtitle tracks for a media item.
 * Considers: session state > per-media override > matching rules > global preferences.
 */
export function useTrackSelection(
  mediaType: 'movie' | 'episode',
  mediaId: string,
  showId?: string,
  enabled = true
) {
  return trpc.playbackPreferences.selectTracks.useQuery(
    { mediaType, mediaId, showId },
    { enabled: enabled && !!mediaId }
  );
}


