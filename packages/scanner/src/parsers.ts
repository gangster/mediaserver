/**
 * Filename parsing utilities for media files.
 *
 * Parses movie and TV show filenames to extract metadata like title, year,
 * season/episode numbers, resolution, etc.
 */

import type { ParsedMovie, ParsedEpisode } from './types.js';

/** Common video release terms to strip from titles */
const RELEASE_TERMS = [
  'REMASTERED',
  'REPACK',
  'PROPER',
  'EXTENDED',
  'UNRATED',
  'DIRECTORS.CUT',
  'THEATRICAL',
  'IMAX',
  'HDR',
  'HDR10',
  'DOLBY.VISION',
  'DV',
  'HYBRID',
  '3D',
  'REMUX',
];

/** Resolution patterns */
const RESOLUTIONS: Record<string, string> = {
  '2160p': '4K',
  '4K': '4K',
  'UHD': '4K',
  '1080p': '1080p',
  '1080i': '1080p',
  '720p': '720p',
  '480p': '480p',
  'SD': '480p',
};

/** Source patterns */
const SOURCES: Record<string, string> = {
  'BLURAY': 'Blu-ray',
  'BLU-RAY': 'Blu-ray',
  'BDRIP': 'Blu-ray',
  'BRRIP': 'Blu-ray',
  'BDREMUX': 'Blu-ray Remux',
  'WEBDL': 'WEB-DL',
  'WEB-DL': 'WEB-DL',
  'WEBRIP': 'WEBRip',
  'WEB-RIP': 'WEBRip',
  'HDTV': 'HDTV',
  'DVDRIP': 'DVDRip',
  'DVDSCR': 'DVDScr',
  'HDCAM': 'HDCAM',
  'CAM': 'CAM',
  'TS': 'Telesync',
  'AMZN': 'Amazon',
  'NF': 'Netflix',
  'DSNP': 'Disney+',
  'HMAX': 'HBO Max',
  'ATVP': 'Apple TV+',
  'PCOK': 'Peacock',
  'HULU': 'Hulu',
};

/** Video codec patterns */
const CODECS: Record<string, string> = {
  'X264': 'H.264',
  'H264': 'H.264',
  'H.264': 'H.264',
  'AVC': 'H.264',
  'X265': 'H.265',
  'H265': 'H.265',
  'H.265': 'H.265',
  'HEVC': 'H.265',
  'XVID': 'Xvid',
  'DIVX': 'DivX',
  'VP9': 'VP9',
  'AV1': 'AV1',
};

/**
 * Normalizes a filename for parsing.
 * Replaces common separators with spaces.
 */
function normalizeFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[._]/g, ' ')     // Replace dots and underscores with spaces
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
}

/**
 * Extracts year from a string (1900-2099).
 */
function extractYear(str: string): number | undefined {
  const yearMatch = str.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch?.[1];
  return year ? parseInt(year, 10) : undefined;
}

/**
 * Finds and returns a matched term from a pattern map.
 */
function matchPattern(str: string, patterns: Record<string, string>): string | undefined {
  const upper = str.toUpperCase();
  for (const [pattern, value] of Object.entries(patterns)) {
    if (upper.includes(pattern)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Extracts release group from filename.
 * Usually the last component after a dash.
 */
function extractGroup(str: string): string | undefined {
  const match = str.match(/-([A-Za-z0-9]+)$/);
  return match ? match[1] : undefined;
}

/**
 * Cleans a title string by removing release terms and extra info.
 */
function cleanTitle(title: string): string {
  let cleaned = title;

  // Remove year and everything after
  const yearMatch = cleaned.match(/\s*(19\d{2}|20\d{2})/);
  if (yearMatch && yearMatch.index !== undefined) {
    cleaned = cleaned.substring(0, yearMatch.index);
  }

  // Remove release terms
  const upperCleaned = cleaned.toUpperCase();
  for (const term of RELEASE_TERMS) {
    if (upperCleaned.includes(term)) {
      cleaned = cleaned.replace(new RegExp(term, 'gi'), '');
    }
  }

  // Remove resolution patterns
  for (const res of Object.keys(RESOLUTIONS)) {
    cleaned = cleaned.replace(new RegExp(`\\b${res}\\b`, 'gi'), '');
  }

  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Parses a movie filename to extract metadata.
 *
 * @example
 * parseMovieFilename('The.Matrix.1999.2160p.UHD.BluRay.x265-GROUP.mkv')
 * // { title: 'The Matrix', year: 1999, resolution: '4K', source: 'Blu-ray', codec: 'H.265', group: 'GROUP' }
 */
export function parseMovieFilename(filename: string): ParsedMovie {
  const normalized = normalizeFilename(filename);

  const year = extractYear(normalized);
  const resolution = matchPattern(normalized, RESOLUTIONS);
  const source = matchPattern(normalized, SOURCES);
  const codec = matchPattern(normalized, CODECS);
  const group = extractGroup(normalized);
  const title = cleanTitle(normalized);

  return {
    title,
    year,
    resolution,
    source,
    codec,
    group,
  };
}

/**
 * TV episode patterns.
 * Supports various formats like S01E01, 1x01, Season 1 Episode 1, etc.
 */
const TV_PATTERNS = [
  // S01E01 format (most common)
  /S(\d{1,2})E(\d{1,3})/i,
  // S01E01E02 format (multi-episode)
  /S(\d{1,2})E(\d{1,3})(?:E\d{1,3})+/i,
  // 1x01 format
  /(\d{1,2})x(\d{1,3})/i,
  // Season 1 Episode 1 format
  /Season\s*(\d{1,2})\s*Episode\s*(\d{1,3})/i,
  // 101 format (risky - only for 3-4 digit numbers)
  /\b(\d)(\d{2})\b/,
];

/**
 * Parses a TV episode filename to extract metadata.
 *
 * @example
 * parseTVFilename('Breaking.Bad.S05E16.Felina.1080p.BluRay.x264-GROUP.mkv')
 * // { showTitle: 'Breaking Bad', seasonNumber: 5, episodeNumber: 16, episodeTitle: 'Felina', resolution: '1080p', ... }
 */
export function parseTVFilename(filename: string): ParsedEpisode {
  const normalized = normalizeFilename(filename);

  let seasonNumber = 0;
  let episodeNumber = 0;
  let matchIndex = -1;

  // Try each pattern to find season/episode
  for (const pattern of TV_PATTERNS) {
    const match = normalized.match(pattern);
    const season = match?.[1];
    const episode = match?.[2];
    if (match && match.index !== undefined && season && episode) {
      seasonNumber = parseInt(season, 10);
      episodeNumber = parseInt(episode, 10);
      matchIndex = match.index;
      break;
    }
  }

  // Extract show title (everything before the season/episode pattern)
  let showTitle = '';
  if (matchIndex > 0) {
    showTitle = cleanTitle(normalized.substring(0, matchIndex));
  } else {
    // Fallback: try to extract title before year or resolution
    showTitle = cleanTitle(normalized);
  }

  // Try to extract episode title (between episode number and technical info)
  let episodeTitle: string | undefined;
  const afterEpisode = normalized.substring(matchIndex + 6); // Skip past S01E01
  const techMatch = afterEpisode.match(/\b(1080p|720p|2160p|4K|HDTV|WEB)/i);
  if (techMatch && techMatch.index !== undefined && techMatch.index > 1) {
    const potentialTitle = afterEpisode.substring(0, techMatch.index).trim();
    if (potentialTitle.length > 2 && !/^\d+$/.test(potentialTitle)) {
      episodeTitle = potentialTitle;
    }
  }

  const year = extractYear(normalized);
  const resolution = matchPattern(normalized, RESOLUTIONS);

  return {
    showTitle,
    seasonNumber,
    episodeNumber,
    episodeTitle,
    year,
    resolution,
  };
}

/**
 * Determines if a filename looks like a TV episode.
 */
export function isTVEpisode(filename: string): boolean {
  const normalized = normalizeFilename(filename);
  return TV_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Auto-detects and parses a filename.
 */
export function parseFilename(
  filename: string,
): { type: 'movie'; parsed: ParsedMovie } | { type: 'episode'; parsed: ParsedEpisode } {
  if (isTVEpisode(filename)) {
    return { type: 'episode', parsed: parseTVFilename(filename) };
  }
  return { type: 'movie', parsed: parseMovieFilename(filename) };
}

