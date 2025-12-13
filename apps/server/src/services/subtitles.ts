/**
 * Subtitle Service
 *
 * Handles scanning and storing subtitle tracks (embedded and external).
 */

import { eq, and, type Database, subtitleTracks } from '@mediaserver/db';
import type { MediaStream } from '@mediaserver/core';
import { logger } from '../lib/logger.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { nanoid } from 'nanoid';

const log = logger.child({ service: 'subtitles' });

/** Supported external subtitle extensions */
const SUBTITLE_EXTENSIONS = ['.srt', '.ass', '.ssa', '.vtt', '.sub', '.idx', '.sup'];

/** Language code to name mapping */
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

/**
 * Get human-readable language name from ISO code.
 */
export function getLanguageName(code: string | undefined): string {
  if (!code) return 'Unknown';
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

/**
 * Normalize subtitle codec to a standard format name.
 */
function normalizeFormat(codec: string): string {
  const codecLower = codec.toLowerCase();
  
  if (codecLower.includes('subrip') || codecLower === 'srt') return 'srt';
  if (codecLower.includes('ass') || codecLower.includes('ssa')) return 'ass';
  if (codecLower.includes('webvtt') || codecLower === 'vtt') return 'vtt';
  if (codecLower.includes('pgs') || codecLower.includes('hdmv_pgs')) return 'pgs';
  if (codecLower.includes('vobsub') || codecLower.includes('dvd_subtitle')) return 'vobsub';
  if (codecLower.includes('dvb')) return 'dvb';
  if (codecLower.includes('mov_text')) return 'mov_text';
  if (codecLower.includes('eia_608') || codecLower.includes('cc')) return 'cc';
  
  return codec;
}

/**
 * Detect if a subtitle track is SDH (Subtitles for Deaf/Hard of Hearing).
 * Checks both the hearingImpaired flag and title patterns.
 */
function isSdh(stream: MediaStream): boolean {
  if (stream.hearingImpaired) return true;
  
  const title = stream.title?.toLowerCase() ?? '';
  return (
    title.includes('sdh') ||
    title.includes('hearing impaired') ||
    title.includes('deaf') ||
    title.includes('cc') ||
    title.includes('closed caption')
  );
}

/**
 * Detect if subtitle is closed captions.
 */
function isCc(stream: MediaStream): boolean {
  const codec = stream.codec?.toLowerCase() ?? '';
  const title = stream.title?.toLowerCase() ?? '';
  
  return (
    codec.includes('eia_608') ||
    codec.includes('eia_708') ||
    codec.includes('cc') ||
    title.includes('cc') ||
    title.includes('closed caption')
  );
}

/**
 * Extract language code from a subtitle filename.
 * Examples: movie.en.srt, movie.eng.srt, movie.english.srt
 */
function extractLanguageFromFilename(filename: string): string | undefined {
  const baseName = path.basename(filename, path.extname(filename));
  const parts = baseName.split('.');
  
  if (parts.length < 2) return undefined;
  
  // Check last part before extension
  const lastPart = parts[parts.length - 1]?.toLowerCase();
  if (lastPart && LANGUAGE_NAMES[lastPart]) {
    return lastPart;
  }
  
  // Check second to last part (e.g., movie.en.forced.srt)
  if (parts.length >= 3) {
    const secondLast = parts[parts.length - 2]?.toLowerCase();
    if (secondLast && LANGUAGE_NAMES[secondLast]) {
      return secondLast;
    }
  }
  
  return undefined;
}

/**
 * Check if filename indicates forced subtitles.
 */
function isFilenameForced(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.includes('.forced.') || lower.includes('_forced.');
}

/**
 * Check if filename indicates SDH subtitles.
 */
function isFilenameSdh(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.includes('.sdh.') ||
    lower.includes('_sdh.') ||
    lower.includes('.hi.') ||
    lower.includes('_hi.') ||
    lower.includes('.cc.')
  );
}

/**
 * Save embedded subtitle tracks from media streams.
 */
export async function saveEmbeddedSubtitles(
  db: Database,
  mediaType: 'movie' | 'episode',
  mediaId: string,
  streams: MediaStream[]
): Promise<number> {
  const subtitleStreams = streams.filter((s) => s.type === 'subtitle');
  
  if (subtitleStreams.length === 0) {
    return 0;
  }

  // Delete existing embedded subtitles for this media
  await db.delete(subtitleTracks).where(
    and(
      eq(subtitleTracks.mediaType, mediaType),
      eq(subtitleTracks.mediaId, mediaId),
      eq(subtitleTracks.source, 'embedded')
    )
  );

  let saved = 0;
  for (const stream of subtitleStreams) {
    try {
      await db.insert(subtitleTracks).values({
        id: nanoid(),
        mediaType,
        mediaId,
        source: 'embedded',
        streamIndex: stream.index,
        format: normalizeFormat(stream.codec),
        language: stream.language,
        languageName: getLanguageName(stream.language),
        title: stream.title,
        isDefault: stream.isDefault ?? false,
        isForced: stream.forced ?? false,
        isSdh: isSdh(stream),
        isCc: isCc(stream),
        codecLongName: stream.codecLongName,
      });
      saved++;
    } catch (error) {
      log.error({ error, mediaId, streamIndex: stream.index }, 'Failed to save embedded subtitle');
    }
  }

  log.debug({ mediaType, mediaId, count: saved }, 'Saved embedded subtitle tracks');
  return saved;
}

/**
 * Scan for external subtitle files (sidecars) next to a video file.
 */
export async function scanExternalSubtitles(
  db: Database,
  mediaType: 'movie' | 'episode',
  mediaId: string,
  videoFilePath: string
): Promise<number> {
  const videoDir = path.dirname(videoFilePath);
  const videoBaseName = path.basename(videoFilePath, path.extname(videoFilePath));

  // Delete existing external subtitles for this media
  await db.delete(subtitleTracks).where(
    and(
      eq(subtitleTracks.mediaType, mediaType),
      eq(subtitleTracks.mediaId, mediaId),
      eq(subtitleTracks.source, 'external')
    )
  );

  let saved = 0;

  try {
    const files = await fs.readdir(videoDir);
    
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      
      // Check if it's a subtitle file
      if (!SUBTITLE_EXTENSIONS.includes(ext)) continue;
      
      // Check if it matches the video file (e.g., movie.srt, movie.en.srt)
      const subBaseName = path.basename(file, ext);
      if (!subBaseName.startsWith(videoBaseName)) continue;
      
      const filePath = path.join(videoDir, file);
      const language = extractLanguageFromFilename(file);
      const format = ext.slice(1); // Remove the dot
      
      try {
        await db.insert(subtitleTracks).values({
          id: nanoid(),
          mediaType,
          mediaId,
          source: 'external',
          filePath,
          fileName: file,
          format: normalizeFormat(format),
          language,
          languageName: getLanguageName(language),
          title: language ? getLanguageName(language) : file,
          isDefault: false,
          isForced: isFilenameForced(file),
          isSdh: isFilenameSdh(file),
          isCc: false,
        });
        saved++;
        log.debug({ mediaId, file }, 'Found external subtitle file');
      } catch (error) {
        log.error({ error, mediaId, file }, 'Failed to save external subtitle');
      }
    }
  } catch (error) {
    log.warn({ error, videoDir }, 'Failed to scan directory for subtitles');
  }

  if (saved > 0) {
    log.debug({ mediaType, mediaId, count: saved }, 'Saved external subtitle tracks');
  }
  
  return saved;
}

/**
 * Scan all subtitles (embedded + external) for a media item.
 */
export async function scanSubtitles(
  db: Database,
  mediaType: 'movie' | 'episode',
  mediaId: string,
  videoFilePath: string,
  streams: MediaStream[]
): Promise<{ embedded: number; external: number }> {
  const embedded = await saveEmbeddedSubtitles(db, mediaType, mediaId, streams);
  const external = await scanExternalSubtitles(db, mediaType, mediaId, videoFilePath);
  
  return { embedded, external };
}

/**
 * Get all subtitle tracks for a media item.
 */
export async function getSubtitleTracks(
  db: Database,
  mediaType: 'movie' | 'episode',
  mediaId: string
) {
  return db.query.subtitleTracks.findMany({
    where: and(
      eq(subtitleTracks.mediaType, mediaType),
      eq(subtitleTracks.mediaId, mediaId)
    ),
    orderBy: (tracks, { asc, desc }) => [
      desc(tracks.isDefault),
      asc(tracks.source), // embedded first
      asc(tracks.language),
    ],
  });
}

