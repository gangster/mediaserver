/**
 * Track Selection Service
 *
 * Implements the core algorithm for selecting audio and subtitle tracks
 * based on user preferences, language rules, and actual track availability.
 *
 * Key design principle: Track availability is unpredictable in real-world
 * media libraries (Sonarr/Radarr populated). This service always checks
 * actual availability and uses fallback chains to find the best match.
 */

import {
  type Database,
  playbackPreferences,
  languageRules,
  mediaLanguageOverrides,
  playbackSessionState,
  audioTracks,
  subtitleTracks,
  movies,
  tvShows,
  eq,
  and,
  asc,
} from '@mediaserver/db';
import { logger } from '../lib/logger.js';

const log = logger.child({ service: 'track-selection' });

// =============================================================================
// Types
// =============================================================================

export interface TrackSelectionResult {
  /** Selected audio track ID */
  audioTrackId: string | null;
  /** Selected subtitle track ID (null = subtitles off) */
  subtitleTrackId: string | null;
  /** Forced subtitle track ID (shown even when subtitles "off" if alwaysShowForced) */
  forcedSubtitleTrackId: string | null;

  /** Whether we couldn't honor the user's audio preference */
  audioMismatch: boolean;
  /** Whether we couldn't honor the user's subtitle preference */
  subtitleMismatch: boolean;

  /** What audio language we actually used (for session persistence) */
  audioLanguageUsed: string | null;
  /** What subtitle language we actually used */
  subtitleLanguageUsed: string | null;

  /** Debug info about fallback used */
  fallbackInfo?: {
    audio?: string;
    subtitle?: string;
    reason?: string;
  };
}

interface AudioTrack {
  id: string;
  streamIndex: number;
  codec: string;
  language: string | null;
  channels: number | null;
  channelLayout: string | null;
  isDefault: boolean;
  isOriginal: boolean;
  isCommentary: boolean;
  isDescriptive: boolean;
}

interface SubtitleTrack {
  id: string;
  streamIndex: number | null;
  format: string;
  language: string | null;
  isDefault: boolean;
  isForced: boolean;
  isSdh: boolean;
  isCc: boolean;
}

interface MediaMetadata {
  originalLanguage: string | null;
  originCountry: string[] | null;
  genres: string[] | null;
  title: string;
}

interface PreferenceChain {
  audioLanguages: string[];
  subtitleLanguages: string[];
  subtitleMode: 'off' | 'auto' | 'always' | 'foreign_only';
  alwaysShowForced: boolean;
  preferSdh: boolean;
  preferOriginalAudio: boolean;
  audioQuality: 'highest' | 'balanced' | 'compatible';
}

// =============================================================================
// Audio Quality Ranking
// =============================================================================

/** Codec quality scores (higher = better quality) */
const CODEC_QUALITY: Record<string, number> = {
  truehd: 100,
  'dts-hd ma': 95,
  'dts-hd': 90,
  flac: 85,
  pcm: 80,
  alac: 75,
  eac3: 70,
  dts: 65,
  ac3: 60,
  aac: 50,
  opus: 45,
  vorbis: 40,
  mp3: 30,
};

/**
 * Rank an audio track by quality.
 */
function rankAudioTrack(
  track: AudioTrack,
  qualityPref: 'highest' | 'balanced' | 'compatible'
): number {
  const codec = track.codec?.toLowerCase() ?? '';
  let score = CODEC_QUALITY[codec] ?? 40;

  // More channels = better (for surround sound)
  score += (track.channels ?? 2) * 5;

  // Apply quality preference modifier
  if (qualityPref === 'compatible') {
    // Invert: prefer AAC/AC3 over lossless for compatibility
    score = 100 - score;
  } else if (qualityPref === 'balanced') {
    // Penalize very high (lossless) and very low quality
    if (score > 80) score -= 20;
    if (score < 40) score -= 10;
  }

  // Penalize commentary and descriptive tracks
  if (track.isCommentary) score -= 50;
  if (track.isDescriptive) score -= 30;

  return score;
}

/**
 * Sort audio tracks by quality (best first).
 */
function sortAudioByQuality(
  tracks: AudioTrack[],
  qualityPref: 'highest' | 'balanced' | 'compatible'
): AudioTrack[] {
  return [...tracks].sort(
    (a, b) => rankAudioTrack(b, qualityPref) - rankAudioTrack(a, qualityPref)
  );
}

// =============================================================================
// Language Rule Matching
// =============================================================================

interface LanguageRuleConditions {
  genres?: string[];
  originCountries?: string[];
  originalLanguages?: string[];
  libraryIds?: string[];
  keywords?: string[];
}

/**
 * Check if a language rule matches the given media.
 */
function matchesRule(
  conditions: LanguageRuleConditions,
  metadata: MediaMetadata,
  libraryId?: string
): boolean {
  // All specified conditions must match (AND logic)
  // Each condition array uses OR logic (any value can match)

  if (conditions.genres && conditions.genres.length > 0) {
    const mediaGenres = metadata.genres ?? [];
    const hasMatch = conditions.genres.some((g) =>
      mediaGenres.some((mg) => mg.toLowerCase().includes(g.toLowerCase()))
    );
    if (!hasMatch) return false;
  }

  if (conditions.originCountries && conditions.originCountries.length > 0) {
    const mediaCountries = metadata.originCountry ?? [];
    const hasMatch = conditions.originCountries.some((c) =>
      mediaCountries.includes(c)
    );
    if (!hasMatch) return false;
  }

  if (conditions.originalLanguages && conditions.originalLanguages.length > 0) {
    const mediaLang = metadata.originalLanguage;
    if (!mediaLang) return false;
    const hasMatch = conditions.originalLanguages.some(
      (l) => l.toLowerCase() === mediaLang.toLowerCase()
    );
    if (!hasMatch) return false;
  }

  if (conditions.libraryIds && conditions.libraryIds.length > 0) {
    if (!libraryId || !conditions.libraryIds.includes(libraryId)) {
      return false;
    }
  }

  if (conditions.keywords && conditions.keywords.length > 0) {
    const title = metadata.title.toLowerCase();
    const hasMatch = conditions.keywords.some((k) =>
      title.includes(k.toLowerCase())
    );
    if (!hasMatch) return false;
  }

  return true;
}

// =============================================================================
// Track Selection Logic
// =============================================================================

/**
 * Find the best audio track from available tracks using a fallback chain.
 */
function selectAudioTrack(
  tracks: AudioTrack[],
  languageChain: string[],
  qualityPref: 'highest' | 'balanced' | 'compatible',
  preferOriginal: boolean,
  originalLanguage: string | null
): { track: AudioTrack | null; wasFallback: boolean; languageUsed: string | null } {
  if (tracks.length === 0) {
    return { track: null, wasFallback: false, languageUsed: null };
  }

  // Filter out commentary and descriptive tracks for primary selection
  const primaryTracks = tracks.filter((t) => !t.isCommentary && !t.isDescriptive);
  const tracksToSearch = primaryTracks.length > 0 ? primaryTracks : tracks;

  // If preferOriginal is enabled and we know the original language, prioritize it
  if (preferOriginal && originalLanguage) {
    const originalTracks = tracksToSearch.filter(
      (t) => t.language?.toLowerCase() === originalLanguage.toLowerCase() ||
             t.isOriginal
    );
    if (originalTracks.length > 0) {
      const sorted = sortAudioByQuality(originalTracks, qualityPref);
      return {
        track: sorted[0]!,
        wasFallback: false,
        languageUsed: sorted[0]!.language,
      };
    }
  }

  // Try each language in the fallback chain
  for (const lang of languageChain) {
    const langTracks = tracksToSearch.filter(
      (t) => t.language?.toLowerCase() === lang.toLowerCase()
    );
    if (langTracks.length > 0) {
      const sorted = sortAudioByQuality(langTracks, qualityPref);
      return {
        track: sorted[0]!,
        wasFallback: lang !== languageChain[0],
        languageUsed: sorted[0]!.language,
      };
    }
  }

  // No language match - fall back to default track or first available
  const defaultTrack = tracksToSearch.find((t) => t.isDefault);
  if (defaultTrack) {
    return {
      track: defaultTrack,
      wasFallback: true,
      languageUsed: defaultTrack.language,
    };
  }

  // Last resort: best quality track
  const sorted = sortAudioByQuality(tracksToSearch, qualityPref);
  return {
    track: sorted[0] ?? null,
    wasFallback: true,
    languageUsed: sorted[0]?.language ?? null,
  };
}

/**
 * Find the best subtitle track from available tracks using a fallback chain.
 */
function selectSubtitleTrack(
  tracks: SubtitleTrack[],
  languageChain: string[],
  preferSdh: boolean,
  mode: 'off' | 'auto' | 'always' | 'foreign_only',
  audioLanguage: string | null
): { track: SubtitleTrack | null; wasFallback: boolean; languageUsed: string | null } {
  if (tracks.length === 0 || mode === 'off') {
    return { track: null, wasFallback: false, languageUsed: null };
  }

  // Filter out forced tracks for primary selection (handled separately)
  const primaryTracks = tracks.filter((t) => !t.isForced);

  // For 'foreign_only' mode, only show subtitles if audio is not in user's preferred language
  if (mode === 'foreign_only') {
    const userPreferredAudio = languageChain[0]?.toLowerCase();
    if (audioLanguage?.toLowerCase() === userPreferredAudio) {
      // Audio is in preferred language, no subtitles needed
      return { track: null, wasFallback: false, languageUsed: null };
    }
  }

  // For 'auto' mode, show subtitles if audio differs from subtitle preference
  if (mode === 'auto') {
    const preferredSubLang = languageChain[0]?.toLowerCase();
    if (audioLanguage?.toLowerCase() === preferredSubLang) {
      // Audio matches preferred subtitle language, no subtitles needed
      return { track: null, wasFallback: false, languageUsed: null };
    }
  }

  // Try each language in the fallback chain
  for (const lang of languageChain) {
    const langTracks = primaryTracks.filter(
      (t) => t.language?.toLowerCase() === lang.toLowerCase()
    );
    if (langTracks.length === 0) continue;

    // Prefer SDH if user wants it
    if (preferSdh) {
      const sdhTrack = langTracks.find((t) => t.isSdh);
      if (sdhTrack) {
        return {
          track: sdhTrack,
          wasFallback: lang !== languageChain[0],
          languageUsed: sdhTrack.language,
        };
      }
    }

    // Otherwise prefer non-SDH track
    const regularTrack = langTracks.find((t) => !t.isSdh);
    if (regularTrack) {
      return {
        track: regularTrack,
        wasFallback: lang !== languageChain[0],
        languageUsed: regularTrack.language,
      };
    }

    // Any track in this language
    return {
      track: langTracks[0]!,
      wasFallback: lang !== languageChain[0],
      languageUsed: langTracks[0]!.language,
    };
  }

  // No language match - fall back to default track (only for 'always' mode)
  if (mode === 'always') {
    const defaultTrack = primaryTracks.find((t) => t.isDefault);
    if (defaultTrack) {
      return {
        track: defaultTrack,
        wasFallback: true,
        languageUsed: defaultTrack.language,
      };
    }
  }

  return { track: null, wasFallback: true, languageUsed: null };
}

/**
 * Find the forced subtitle track for the current audio language.
 */
function findForcedSubtitle(
  tracks: SubtitleTrack[],
  audioLanguage: string | null
): SubtitleTrack | null {
  if (!audioLanguage) return null;

  // Find forced subtitle in the same language as audio
  return (
    tracks.find(
      (t) =>
        t.isForced && t.language?.toLowerCase() === audioLanguage.toLowerCase()
    ) ?? null
  );
}

// =============================================================================
// Main Selection Function
// =============================================================================

/**
 * Select the best audio and subtitle tracks for a media item.
 *
 * This is the main entry point for track selection. It:
 * 1. Fetches available tracks from the database
 * 2. Resolves the user's preference chain (session > override > rule > global)
 * 3. Selects the best matching tracks with fallback handling
 * 4. Returns the selection result with mismatch information
 */
export async function selectTracks(
  db: Database,
  userId: string,
  mediaType: 'movie' | 'episode',
  mediaId: string,
  showId?: string
): Promise<TrackSelectionResult> {
  log.debug({ userId, mediaType, mediaId, showId }, 'Selecting tracks');

  // 1. Get available tracks
  const audio = await db.query.audioTracks.findMany({
    where: and(
      eq(audioTracks.mediaType, mediaType),
      eq(audioTracks.mediaId, mediaId)
    ),
    orderBy: [asc(audioTracks.streamIndex)],
  });

  const subtitles = await db.query.subtitleTracks.findMany({
    where: and(
      eq(subtitleTracks.mediaType, mediaType),
      eq(subtitleTracks.mediaId, mediaId)
    ),
    orderBy: [asc(subtitleTracks.streamIndex)],
  });

  // 2. Get media metadata (for rule matching)
  const metadata = await getMediaMetadata(db, mediaType, mediaId, showId);

  // 3. Resolve preference chain
  const prefs = await resolvePreferenceChain(
    db,
    userId,
    mediaType,
    mediaId,
    showId,
    metadata
  );

  // 4. Select audio track
  const audioResult = selectAudioTrack(
    audio as AudioTrack[],
    prefs.audioLanguages,
    prefs.audioQuality,
    prefs.preferOriginalAudio,
    metadata.originalLanguage
  );

  // 5. Select subtitle track
  const subtitleResult = selectSubtitleTrack(
    subtitles as SubtitleTrack[],
    prefs.subtitleLanguages,
    prefs.preferSdh,
    prefs.subtitleMode,
    audioResult.languageUsed
  );

  // 6. Find forced subtitle (shown regardless of subtitle mode if alwaysShowForced)
  const forcedSubtitle = prefs.alwaysShowForced
    ? findForcedSubtitle(subtitles as SubtitleTrack[], audioResult.languageUsed)
    : null;

  log.debug(
    {
      audioTrackId: audioResult.track?.id,
      subtitleTrackId: subtitleResult.track?.id,
      forcedSubtitleId: forcedSubtitle?.id,
      audioMismatch: audioResult.wasFallback,
      subtitleMismatch: subtitleResult.wasFallback,
    },
    'Track selection complete'
  );

  return {
    audioTrackId: audioResult.track?.id ?? null,
    subtitleTrackId: subtitleResult.track?.id ?? null,
    forcedSubtitleTrackId: forcedSubtitle?.id ?? null,
    audioMismatch: audioResult.wasFallback,
    subtitleMismatch: subtitleResult.wasFallback,
    audioLanguageUsed: audioResult.languageUsed,
    subtitleLanguageUsed: subtitleResult.languageUsed,
    fallbackInfo:
      audioResult.wasFallback || subtitleResult.wasFallback
        ? {
            audio: audioResult.wasFallback ? audioResult.languageUsed ?? undefined : undefined,
            subtitle: subtitleResult.wasFallback ? subtitleResult.languageUsed ?? undefined : undefined,
          }
        : undefined,
  };
}

/**
 * Get media metadata for rule matching.
 */
async function getMediaMetadata(
  db: Database,
  mediaType: 'movie' | 'episode',
  mediaId: string,
  showId?: string
): Promise<MediaMetadata> {
  if (mediaType === 'movie') {
    const movie = await db.query.movies.findFirst({
      where: eq(movies.id, mediaId),
    });
    return {
      originalLanguage: movie?.originalLanguage ?? null,
      originCountry: movie?.originCountry ? JSON.parse(movie.originCountry) : null,
      genres: movie?.genres ? JSON.parse(movie.genres) : null,
      title: movie?.title ?? '',
    };
  } else {
    // For episodes, get metadata from the parent show
    const show = await db.query.tvShows.findFirst({
      where: eq(tvShows.id, showId ?? ''),
    });
    return {
      originalLanguage: show?.originalLanguage ?? null,
      originCountry: show?.originCountry ? JSON.parse(show.originCountry) : null,
      genres: show?.genres ? JSON.parse(show.genres) : null,
      title: show?.title ?? '',
    };
  }
}

/**
 * Resolve the user's preference chain.
 *
 * Priority order:
 * 1. Session state (for binge-watching continuity)
 * 2. Per-media override ("Remember for this show")
 * 3. Matching language rule
 * 4. Global preferences
 */
async function resolvePreferenceChain(
  db: Database,
  userId: string,
  mediaType: 'movie' | 'episode',
  mediaId: string,
  showId: string | undefined,
  metadata: MediaMetadata
): Promise<PreferenceChain> {
  // Get global preferences (always needed as fallback)
  const globalPrefs = await db.query.playbackPreferences.findFirst({
    where: eq(playbackPreferences.userId, userId),
  });

  const defaults: PreferenceChain = {
    audioLanguages: globalPrefs?.audioLanguages
      ? JSON.parse(globalPrefs.audioLanguages)
      : ['eng'],
    subtitleLanguages: globalPrefs?.subtitleLanguages
      ? JSON.parse(globalPrefs.subtitleLanguages)
      : ['eng'],
    subtitleMode: (globalPrefs?.subtitleMode as PreferenceChain['subtitleMode']) ?? 'auto',
    alwaysShowForced: globalPrefs?.alwaysShowForced ?? true,
    preferSdh: globalPrefs?.preferSdh ?? false,
    preferOriginalAudio: globalPrefs?.preferOriginalAudio ?? false,
    audioQuality: (globalPrefs?.audioQuality as PreferenceChain['audioQuality']) ?? 'highest',
  };

  // Check session state first (highest priority for continuity)
  if (showId && globalPrefs?.rememberWithinSession) {
    const session = await db.query.playbackSessionState.findFirst({
      where: and(
        eq(playbackSessionState.userId, userId),
        eq(playbackSessionState.showId, showId)
      ),
    });

    if (session && session.wasExplicitChange) {
      // Check if session is still valid
      const expiresAt = new Date(session.expiresAt);
      if (expiresAt > new Date()) {
        // Use session state to modify the chain
        if (session.lastAudioLanguage) {
          defaults.audioLanguages = [
            session.lastAudioLanguage,
            ...defaults.audioLanguages.filter((l) => l !== session.lastAudioLanguage),
          ];
        }
        if (session.lastSubtitleLanguage) {
          defaults.subtitleLanguages = [
            session.lastSubtitleLanguage,
            ...defaults.subtitleLanguages.filter((l) => l !== session.lastSubtitleLanguage),
          ];
        }
        return defaults;
      }
    }
  }

  // Check for per-media override
  const overrideMediaType = mediaType === 'episode' ? 'show' : 'movie';
  const overrideMediaId = mediaType === 'episode' ? showId : mediaId;

  if (overrideMediaId) {
    const override = await db.query.mediaLanguageOverrides.findFirst({
      where: and(
        eq(mediaLanguageOverrides.userId, userId),
        eq(mediaLanguageOverrides.mediaType, overrideMediaType),
        eq(mediaLanguageOverrides.mediaId, overrideMediaId)
      ),
    });

    if (override) {
      return {
        audioLanguages: override.audioLanguages
          ? JSON.parse(override.audioLanguages)
          : defaults.audioLanguages,
        subtitleLanguages: override.subtitleLanguages
          ? JSON.parse(override.subtitleLanguages)
          : defaults.subtitleLanguages,
        subtitleMode: (override.subtitleMode as PreferenceChain['subtitleMode']) ?? defaults.subtitleMode,
        alwaysShowForced: defaults.alwaysShowForced,
        preferSdh: defaults.preferSdh,
        preferOriginalAudio: defaults.preferOriginalAudio,
        audioQuality: defaults.audioQuality,
      };
    }
  }

  // Check for matching language rule
  const rules = await db.query.languageRules.findMany({
    where: and(
      eq(languageRules.userId, userId),
      eq(languageRules.enabled, true)
    ),
    orderBy: [asc(languageRules.priority)],
  });

  for (const rule of rules) {
    const conditions = JSON.parse(rule.conditions) as LanguageRuleConditions;
    if (matchesRule(conditions, metadata)) {
      return {
        audioLanguages: JSON.parse(rule.audioLanguages),
        subtitleLanguages: JSON.parse(rule.subtitleLanguages),
        subtitleMode: (rule.subtitleMode as PreferenceChain['subtitleMode']) ?? defaults.subtitleMode,
        alwaysShowForced: defaults.alwaysShowForced,
        preferSdh: defaults.preferSdh,
        preferOriginalAudio: defaults.preferOriginalAudio,
        audioQuality: defaults.audioQuality,
      };
    }
  }

  // No override or rule matched, use global defaults
  return defaults;
}

