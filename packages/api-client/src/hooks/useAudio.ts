/**
 * Audio track hooks.
 */

import { trpc } from '../client.js';

/** Audio track shape */
export interface AudioTrack {
  id: string;
  streamIndex: number;
  codec: string;
  codecLongName?: string | null;
  language?: string | null;
  languageName?: string | null;
  title?: string | null;
  channels?: number | null;
  channelLayout?: string | null;
  sampleRate?: number | null;
  isDefault: boolean;
  isOriginal: boolean;
  isCommentary: boolean;
  isDescriptive: boolean;
}

/**
 * Get audio tracks for a movie.
 */
export function useMovieAudioTracks(movieId: string, enabled = true) {
  return trpc.audio.getMovieTracks.useQuery(
    { movieId },
    { enabled: enabled && !!movieId }
  );
}

/**
 * Get audio tracks for an episode.
 */
export function useEpisodeAudioTracks(episodeId: string, enabled = true) {
  return trpc.audio.getEpisodeTracks.useQuery(
    { episodeId },
    { enabled: enabled && !!episodeId }
  );
}

/**
 * Get available audio languages across all media.
 */
export function useAvailableAudioLanguages(enabled = true) {
  return trpc.playbackPreferences.getAvailableAudioLanguages.useQuery(undefined, { enabled });
}

