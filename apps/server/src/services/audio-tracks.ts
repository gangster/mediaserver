/**
 * Audio Track Service
 *
 * Handles scanning and storing audio tracks from media files.
 */

import { eq, and, type Database, audioTracks } from '@mediaserver/db';
import type { MediaStream } from '@mediaserver/core';
import { logger } from '../lib/logger.js';
import { nanoid } from 'nanoid';

const log = logger.child({ service: 'audio-tracks' });

/** Language code to name mapping (ISO 639-2/B and ISO 639-1) */
const LANGUAGE_NAMES: Record<string, string> = {
  eng: 'English',
  en: 'English',
  spa: 'Spanish',
  es: 'Spanish',
  fre: 'French',
  fra: 'French',
  fr: 'French',
  ger: 'German',
  deu: 'German',
  de: 'German',
  ita: 'Italian',
  it: 'Italian',
  por: 'Portuguese',
  pt: 'Portuguese',
  rus: 'Russian',
  ru: 'Russian',
  jpn: 'Japanese',
  ja: 'Japanese',
  kor: 'Korean',
  ko: 'Korean',
  chi: 'Chinese',
  zho: 'Chinese',
  zh: 'Chinese',
  ara: 'Arabic',
  ar: 'Arabic',
  hin: 'Hindi',
  hi: 'Hindi',
  dut: 'Dutch',
  nld: 'Dutch',
  nl: 'Dutch',
  pol: 'Polish',
  pl: 'Polish',
  tur: 'Turkish',
  tr: 'Turkish',
  vie: 'Vietnamese',
  vi: 'Vietnamese',
  tha: 'Thai',
  th: 'Thai',
  swe: 'Swedish',
  sv: 'Swedish',
  nor: 'Norwegian',
  no: 'Norwegian',
  dan: 'Danish',
  da: 'Danish',
  fin: 'Finnish',
  fi: 'Finnish',
  heb: 'Hebrew',
  he: 'Hebrew',
  gre: 'Greek',
  ell: 'Greek',
  el: 'Greek',
  cze: 'Czech',
  ces: 'Czech',
  cs: 'Czech',
  hun: 'Hungarian',
  hu: 'Hungarian',
  rum: 'Romanian',
  ron: 'Romanian',
  ro: 'Romanian',
  ukr: 'Ukrainian',
  uk: 'Ukrainian',
  ind: 'Indonesian',
  id: 'Indonesian',
  may: 'Malay',
  msa: 'Malay',
  ms: 'Malay',
  und: 'Unknown',
};

/** Normalize language code to ISO 639-2/B (3-letter code) */
const LANGUAGE_NORMALIZE: Record<string, string> = {
  en: 'eng',
  es: 'spa',
  fr: 'fra',
  de: 'deu',
  it: 'ita',
  pt: 'por',
  ru: 'rus',
  ja: 'jpn',
  ko: 'kor',
  zh: 'zho',
  ar: 'ara',
  hi: 'hin',
  nl: 'nld',
  pl: 'pol',
  tr: 'tur',
  vi: 'vie',
  th: 'tha',
  sv: 'swe',
  no: 'nor',
  da: 'dan',
  fi: 'fin',
  he: 'heb',
  el: 'ell',
  cs: 'ces',
  hu: 'hun',
  ro: 'ron',
  uk: 'ukr',
  id: 'ind',
  ms: 'msa',
  // Handle alternate 3-letter codes
  fre: 'fra',
  ger: 'deu',
  dut: 'nld',
  chi: 'zho',
  gre: 'ell',
  cze: 'ces',
  rum: 'ron',
  may: 'msa',
};

/**
 * Normalize language code to ISO 639-2/B format.
 */
export function normalizeLanguageCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const lower = code.toLowerCase();
  return LANGUAGE_NORMALIZE[lower] ?? lower;
}

/**
 * Get human-readable language name from ISO code.
 */
export function getLanguageName(code: string | undefined): string {
  if (!code) return 'Unknown';
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

/**
 * Normalize audio codec name for consistent storage.
 */
function normalizeCodec(codec: string): string {
  const lower = codec.toLowerCase();

  // Common audio codecs
  if (lower.includes('aac')) return 'aac';
  if (lower.includes('ac3') || lower === 'ac-3') return 'ac3';
  if (lower.includes('eac3') || lower === 'e-ac-3' || lower === 'ec-3') return 'eac3';
  if (lower.includes('truehd') || lower === 'mlp') return 'truehd';
  if (lower.includes('dts-hd ma') || lower === 'dts-hd.ma') return 'dts-hd ma';
  if (lower.includes('dts-hd') || lower === 'dts-hd.hra') return 'dts-hd';
  if (lower.includes('dts')) return 'dts';
  if (lower.includes('flac')) return 'flac';
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('vorbis')) return 'vorbis';
  if (lower.includes('mp3') || lower === 'mp3float') return 'mp3';
  if (lower.includes('pcm') || lower.startsWith('pcm_')) return 'pcm';
  if (lower.includes('alac')) return 'alac';

  return codec;
}

/**
 * Detect if an audio track is commentary.
 */
function isCommentary(stream: MediaStream): boolean {
  const title = stream.title?.toLowerCase() ?? '';
  return (
    title.includes('commentary') ||
    title.includes('director') ||
    title.includes('cast') ||
    title.includes('crew') ||
    title.includes('filmmaker')
  );
}

/**
 * Detect if an audio track is descriptive audio (for visually impaired).
 */
function isDescriptive(stream: MediaStream): boolean {
  const title = stream.title?.toLowerCase() ?? '';
  return (
    title.includes('descriptive') ||
    title.includes('audio description') ||
    title.includes('ad ') ||
    title.includes('(ad)') ||
    title.includes('visually impaired')
  );
}

/**
 * Format channel layout for display.
 * Converts FFmpeg channel layouts to human-readable formats.
 */
function formatChannelLayout(channels: number | undefined, layout: string | undefined): string | undefined {
  if (layout) {
    const lower = layout.toLowerCase();
    if (lower.includes('7.1')) return '7.1';
    if (lower.includes('5.1')) return '5.1';
    if (lower.includes('stereo') || lower === '2.0') return 'Stereo';
    if (lower.includes('mono') || lower === '1.0') return 'Mono';
    if (lower.includes('atmos')) return 'Atmos';
    if (lower.includes('quad')) return '4.0';
    return layout;
  }

  // Fallback to channel count
  if (channels === undefined) return undefined;
  switch (channels) {
    case 1:
      return 'Mono';
    case 2:
      return 'Stereo';
    case 6:
      return '5.1';
    case 8:
      return '7.1';
    default:
      return `${channels} ch`;
  }
}

/**
 * Save audio tracks from media streams.
 */
export async function saveAudioTracks(
  db: Database,
  mediaType: 'movie' | 'episode',
  mediaId: string,
  streams: MediaStream[],
  originalLanguage?: string
): Promise<number> {
  const audioStreams = streams.filter((s) => s.type === 'audio');

  if (audioStreams.length === 0) {
    return 0;
  }

  // Delete existing audio tracks for this media
  await db.delete(audioTracks).where(
    and(eq(audioTracks.mediaType, mediaType), eq(audioTracks.mediaId, mediaId))
  );

  let saved = 0;
  for (const stream of audioStreams) {
    try {
      const language = normalizeLanguageCode(stream.language);
      const isOriginal =
        originalLanguage && language
          ? normalizeLanguageCode(originalLanguage) === language
          : stream.isDefault ?? false;

      await db.insert(audioTracks).values({
        id: nanoid(),
        mediaType,
        mediaId,
        streamIndex: stream.index,
        codec: normalizeCodec(stream.codec),
        codecLongName: stream.codecLongName,
        language,
        languageName: getLanguageName(language),
        title: stream.title,
        channels: stream.channels,
        channelLayout: formatChannelLayout(stream.channels, stream.channelLayout),
        sampleRate: stream.sampleRate,
        // Note: bitRate and bitsPerSample not available from FFprobe stream data
        isDefault: stream.isDefault ?? false,
        isOriginal,
        isCommentary: isCommentary(stream),
        isDescriptive: isDescriptive(stream),
      });
      saved++;
    } catch (error) {
      log.error(
        { error, mediaId, streamIndex: stream.index },
        'Failed to save audio track'
      );
    }
  }

  log.debug({ mediaType, mediaId, count: saved }, 'Saved audio tracks');
  return saved;
}

/**
 * Get all audio tracks for a media item.
 */
export async function getAudioTracks(
  db: Database,
  mediaType: 'movie' | 'episode',
  mediaId: string
) {
  return db.query.audioTracks.findMany({
    where: and(
      eq(audioTracks.mediaType, mediaType),
      eq(audioTracks.mediaId, mediaId)
    ),
    orderBy: (tracks, { asc, desc }) => [
      desc(tracks.isDefault),
      desc(tracks.isOriginal),
      asc(tracks.isCommentary), // Non-commentary first
      asc(tracks.language),
    ],
  });
}

/**
 * Get available audio languages across all media.
 */
export async function getAvailableAudioLanguages(db: Database) {
  const tracks = await db.query.audioTracks.findMany({
    columns: {
      language: true,
      languageName: true,
    },
  });

  // Deduplicate and sort
  const languageMap = new Map<string, string>();
  for (const track of tracks) {
    if (track.language && !languageMap.has(track.language)) {
      languageMap.set(track.language, track.languageName ?? getLanguageName(track.language));
    }
  }

  return Array.from(languageMap.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

