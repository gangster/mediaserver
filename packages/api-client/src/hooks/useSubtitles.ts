/**
 * Subtitle hooks for fetching subtitle tracks.
 *
 * Note: Subtitle preferences have been moved to usePlaybackPreferences.ts
 * as part of the unified audio/subtitle preference system.
 */

import { trpc } from '../client.js';

/** Subtitle track shape */
export interface SubtitleTrack {
  id: string;
  source: 'embedded' | 'external';
  streamIndex?: number | null;
  filePath?: string | null;
  fileName?: string | null;
  format: string;
  language?: string | null;
  languageName?: string | null;
  title?: string | null;
  isDefault: boolean;
  isForced: boolean;
  isSdh: boolean;
  isCc: boolean;
  codecLongName?: string | null;
}

/** Language option shape */
export interface LanguageOption {
  code: string;
  name: string;
}

/** Available language shape (returned from available language endpoints) */
export interface AvailableLanguage {
  code: string;
  name: string;
}

/**
 * Get subtitle tracks for a movie.
 */
export function useMovieSubtitles(movieId: string, enabled = true) {
  return trpc.subtitles.getMovieTracks.useQuery(
    { movieId },
    { enabled: enabled && !!movieId }
  );
}

/**
 * Get subtitle tracks for an episode.
 */
export function useEpisodeSubtitles(episodeId: string, enabled = true) {
  return trpc.subtitles.getEpisodeTracks.useQuery(
    { episodeId },
    { enabled: enabled && !!episodeId }
  );
}

/**
 * Get available subtitle languages across all media.
 */
export function useAvailableSubtitleLanguages(enabled = true) {
  return trpc.playbackPreferences.getAvailableSubtitleLanguages.useQuery(undefined, { enabled });
}
