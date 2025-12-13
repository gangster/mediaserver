/**
 * Robust filename parsing for media files.
 *
 * Handles all common naming conventions:
 * - Scene releases: `Movie.Name.2022.1080p.BluRay.x264-GROUP.mkv`
 * - Plex format: `Movie Name (2022)/Movie Name (2022).mkv`
 * - Radarr/Sonarr: `Movie (2022) [imdbid-tt123] - [Bluray-1080p].mkv`
 * - Anime: `[Group] Show Name - 01 [1080p].mkv`
 * - Simple: `Movie Name 2022.mkv`
 * - Dash-separated: `Show - S01E01 - Episode Title.mkv`
 */

import type { ParsedMovie, ParsedEpisode } from './types.js';

// ============================================================================
// Constants - Comprehensive lists of known patterns
// ============================================================================

/** Video quality/resolution patterns */
const RESOLUTIONS: Record<string, string> = {
  '2160p': '4K',
  '4k': '4K',
  'uhd': '4K',
  '1080p': '1080p',
  '1080i': '1080p',
  '720p': '720p',
  '576p': '576p',
  '480p': '480p',
  '480i': '480p',
  'sd': '480p',
};

/** Video sources */
const SOURCES: Record<string, string> = {
  'bluray': 'Blu-ray',
  'blu-ray': 'Blu-ray',
  'bdrip': 'Blu-ray',
  'brrip': 'Blu-ray',
  'bdremux': 'Blu-ray Remux',
  'remux': 'Remux',
  'webdl': 'WEB-DL',
  'web-dl': 'WEB-DL',
  'webrip': 'WEBRip',
  'web-rip': 'WEBRip',
  'web': 'WEB',
  'hdtv': 'HDTV',
  'pdtv': 'PDTV',
  'dsr': 'DSR',
  'dvdrip': 'DVDRip',
  'dvd': 'DVD',
  'dvdscr': 'DVDScr',
  'screener': 'Screener',
  'hdcam': 'HDCAM',
  'cam': 'CAM',
  'ts': 'Telesync',
  'telesync': 'Telesync',
  'tc': 'Telecine',
  'hdrip': 'HDRip',
  'hdts': 'HDTS',
  'ppvrip': 'PPVRip',
  'r5': 'R5',
  'scr': 'Screener',
  'dvdscreener': 'DVDScr',
  'bdscr': 'BDScr',
};

/** Video codecs */
const CODECS: Record<string, string> = {
  'x264': 'H.264',
  'h264': 'H.264',
  'h.264': 'H.264',
  'avc': 'H.264',
  'x265': 'H.265',
  'h265': 'H.265',
  'h.265': 'H.265',
  'hevc': 'H.265',
  'xvid': 'Xvid',
  'divx': 'DivX',
  'vp9': 'VP9',
  'av1': 'AV1',
  'mpeg2': 'MPEG-2',
  'mpeg-2': 'MPEG-2',
  'vc1': 'VC-1',
  'vc-1': 'VC-1',
  'wmv': 'WMV',
};

/** Audio codecs */
const AUDIO_CODECS = [
  'aac', 'ac3', 'eac3', 'e-ac3', 'dts', 'dts-hd', 'dtshd', 'dts-hdma',
  'truehd', 'true-hd', 'atmos', 'flac', 'mp3', 'lpcm', 'pcm', 'opus',
  'vorbis', 'aac2.0', 'aac5.1', 'dd5.1', 'dd2.0', 'ddp5.1', 'ddp2.0',
];

/** Streaming services */
const SERVICES = [
  'amzn', 'amazon', 'nf', 'netflix', 'dsnp', 'disney+', 'disneyplus',
  'hmax', 'hbomax', 'hbo', 'atvp', 'appletv+', 'appletvplus', 'apple',
  'pcok', 'peacock', 'hulu', 'paramount+', 'paramountplus', 'prmnt',
  'crav', 'crave', 'stan', 'it', 'itunes', 'vudu', 'ma', 'moviesanywhere',
  'criterion', 'mubi', 'shudder', 'roku', 'tubi', 'pluto', 'max',
];

/** Release/edition terms to strip */
const RELEASE_TERMS = [
  'remastered', 'repack', 'proper', 'rerip', 'real', 'retail',
  'extended', 'unrated', 'uncut', 'theatrical', 'dc', 'directors.cut',
  'directors cut', 'director\'s cut', 'final.cut', 'final cut',
  'imax', 'open.matte', 'open matte', '3d', 'hdr', 'hdr10', 'hdr10+',
  'hdr10plus', 'dolby.vision', 'dolby vision', 'dv', 'hybrid',
  'remux', 'internal', 'limited', 'complete', 'dubbed', 'subbed',
  'multi', 'dual', 'dual.audio', 'dual audio', 'kor', 'eng', 'spa',
  'french', 'german', 'italian', 'japanese', 'chinese', 'korean',
  'nordic', 'norsub', 'swesub', 'finsub', 'dksub',
  'sample', 'proof', 'sync', 'synced', 'fixed',
];

/** TV episode patterns - ordered by specificity */
const TV_PATTERNS = [
  // S01E01 format (most common, highest priority)
  /[.\s_-]S(\d{1,2})[.\s_-]?E(\d{1,3})(?:[.\s_-]?E\d{1,3})*[.\s_-]/i,
  /[.\s_-]S(\d{1,2})E(\d{1,3})(?:E\d{1,3})*(?:[.\s_-]|$)/i,
  /\bS(\d{1,2})E(\d{1,3})\b/i,
  
  // S01.E01 format
  /[.\s_-]S(\d{1,2})\.E(\d{1,3})[.\s_-]/i,
  
  // Season 1 Episode 1 format
  /Season[.\s_-]?(\d{1,2})[.\s_-]?Episode[.\s_-]?(\d{1,3})/i,
  
  // 1x01 format
  /[.\s_-](\d{1,2})x(\d{2,3})[.\s_-]/i,
  /\b(\d{1,2})x(\d{2,3})\b/i,
  
  // Anime format: - 01, - 001, Episode 01
  /[.\s_-](?:E|EP|Episode)[.\s_-]?(\d{1,3})(?:[.\s_-]|$)/i,
  
  // Part format for specials
  /[.\s_-]Part[.\s_-]?(\d{1,2})(?:[.\s_-]|$)/i,
];

/** Anime-specific patterns */
const ANIME_PATTERNS = [
  // [Group] Title - 01 [1080p]
  /^\[([^\]]+)\]\s*(.+?)\s*-\s*(\d{2,3})\s*(?:\[|\(|$)/i,
  // [Group] Title - 01v2 [1080p]
  /^\[([^\]]+)\]\s*(.+?)\s*-\s*(\d{2,3})v\d+\s*(?:\[|\(|$)/i,
  // Title - 01 (1080p)
  /^(.+?)\s*-\s*(\d{2,3})\s*\(/i,
];

// ============================================================================
// Main parsing functions
// ============================================================================

/**
 * Parses a movie filename to extract metadata.
 */
export function parseMovieFilename(filename: string): ParsedMovie {
  const normalized = normalizeForParsing(filename);
  
  // Try to extract year - it's usually the most reliable anchor point
  const yearInfo = extractYear(normalized);
  
  // Extract title (everything before year or quality info)
  let title = extractMovieTitle(normalized, yearInfo?.index);
  
  // Extract quality/technical info
  const resolution = extractPattern(normalized, RESOLUTIONS);
  const source = extractPattern(normalized, SOURCES);
  const codec = extractPattern(normalized, CODECS);
  const group = extractGroup(normalized);
  
  // Final title cleanup
  title = cleanTitle(title);
  
  return {
    title,
    year: yearInfo?.year,
    resolution,
    source,
    codec,
    group,
  };
}

/**
 * Parses a TV episode filename to extract metadata.
 */
export function parseTVFilename(filename: string): ParsedEpisode {
  const normalized = normalizeForParsing(filename);
  
  // Check for anime format first
  const animeResult = parseAnimeFormat(normalized);
  if (animeResult) {
    return animeResult;
  }
  
  // Find season/episode pattern
  const episodeInfo = extractEpisodeInfo(normalized);
  
  // Extract show title (everything before the episode pattern)
  let showTitle = '';
  if (episodeInfo.matchIndex > 0) {
    showTitle = normalized.substring(0, episodeInfo.matchIndex);
  }
  
  // Extract episode title (between episode number and quality info)
  let episodeTitle = extractEpisodeTitle(normalized, episodeInfo.matchEnd);
  
  // Extract quality info
  const resolution = extractPattern(normalized, RESOLUTIONS);
  const yearInfo = extractYear(showTitle);
  
  // Clean up titles
  showTitle = cleanTitle(showTitle);
  episodeTitle = cleanEpisodeTitle(episodeTitle);
  
  return {
    showTitle,
    seasonNumber: episodeInfo.season,
    episodeNumber: episodeInfo.episode,
    episodeTitle: episodeTitle || undefined,
    year: yearInfo?.year,
    resolution,
  };
}

/**
 * Determines if a filename looks like a TV episode.
 */
export function isTVEpisode(filename: string): boolean {
  const normalized = normalizeForParsing(filename);
  
  // Check anime patterns first
  for (const pattern of ANIME_PATTERNS) {
    if (pattern.test(normalized)) return true;
  }
  
  // Check TV patterns
  for (const pattern of TV_PATTERNS) {
    if (pattern.test(normalized)) return true;
  }
  
  return false;
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

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Normalizes a filename for parsing.
 * Preserves structure but makes pattern matching easier.
 */
function normalizeForParsing(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')       // Remove extension
    .replace(/[_]/g, ' ')           // Underscores to spaces
    .replace(/\.(?=\S)/g, ' ')      // Dots to spaces (but keep multiple dots)
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .trim();
}

/**
 * Extracts year from a string.
 * Returns the year and its position in the string.
 */
function extractYear(str: string): { year: number; index: number } | null {
  // Look for year in parentheses first (most reliable)
  const parenMatch = str.match(/\((\d{4})\)/);
  const parenYear = parenMatch?.[1];
  if (parenMatch && parenMatch.index !== undefined && parenYear) {
    const year = parseInt(parenYear, 10);
    if (year >= 1900 && year <= 2099) {
      return { year, index: parenMatch.index };
    }
  }
  
  // Look for year in brackets
  const bracketMatch = str.match(/\[(\d{4})\]/);
  const bracketYear = bracketMatch?.[1];
  if (bracketMatch && bracketMatch.index !== undefined && bracketYear) {
    const year = parseInt(bracketYear, 10);
    if (year >= 1900 && year <= 2099) {
      return { year, index: bracketMatch.index };
    }
  }
  
  // Look for standalone year (must be surrounded by word boundaries or separators)
  const standaloneMatch = str.match(/(?:^|[\s.\-_])(\d{4})(?:[\s.\-_]|$)/);
  const standaloneYear = standaloneMatch?.[1];
  if (standaloneMatch && standaloneMatch.index !== undefined && standaloneYear) {
    const year = parseInt(standaloneYear, 10);
    if (year >= 1900 && year <= 2099) {
      // Adjust index to point to start of year digits
      const adjustedIndex = standaloneMatch.index + (standaloneMatch[0].startsWith(' ') || 
        standaloneMatch[0].startsWith('.') || standaloneMatch[0].startsWith('-') ? 1 : 0);
      return { year, index: adjustedIndex };
    }
  }
  
  return null;
}

/**
 * Extracts a pattern from known mappings.
 */
function extractPattern(str: string, patterns: Record<string, string>): string | undefined {
  const lower = str.toLowerCase();
  
  // Sort by length descending to match longer patterns first
  const sortedPatterns = Object.entries(patterns).sort((a, b) => b[0].length - a[0].length);
  
  for (const [pattern, value] of sortedPatterns) {
    // Create a word-boundary-aware regex
    const regex = new RegExp(`(?:^|[\\s.\\-_\\[\\(])${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[\\s.\\-_\\]\\)]|$)`, 'i');
    if (regex.test(lower)) {
      return value;
    }
  }
  
  return undefined;
}

/**
 * Extracts release group from filename.
 */
function extractGroup(str: string): string | undefined {
  // Look for group at end after dash
  const dashGroup = str.match(/-([A-Za-z0-9]+)$/);
  const dashGroupName = dashGroup?.[1];
  if (dashGroupName && dashGroupName.length >= 2 && dashGroupName.length <= 15) {
    // Make sure it's not a common term
    const lower = dashGroupName.toLowerCase();
    if (!isKnownTerm(lower)) {
      return dashGroupName;
    }
  }
  
  // Look for group in brackets at start (anime style)
  const bracketGroup = str.match(/^\[([^\]]+)\]/);
  const bracketGroupName = bracketGroup?.[1];
  if (bracketGroupName) {
    return bracketGroupName;
  }
  
  return undefined;
}

/**
 * Checks if a string is a known technical term.
 */
function isKnownTerm(str: string): boolean {
  const lower = str.toLowerCase();
  
  // Check all known patterns
  if (RESOLUTIONS[lower]) return true;
  if (SOURCES[lower]) return true;
  if (CODECS[lower]) return true;
  if (AUDIO_CODECS.includes(lower)) return true;
  if (SERVICES.includes(lower)) return true;
  if (RELEASE_TERMS.includes(lower)) return true;
  
  return false;
}

/**
 * Extracts movie title from normalized string.
 */
function extractMovieTitle(str: string, yearIndex?: number): string {
  let title = str;
  
  // If we found a year, take everything before it
  if (yearIndex !== undefined && yearIndex > 0) {
    title = str.substring(0, yearIndex);
  } else {
    // No year found - try to find where quality info starts
    const qualityIndex = findQualityStart(str);
    if (qualityIndex > 0) {
      title = str.substring(0, qualityIndex);
    }
  }
  
  return title;
}

/**
 * Finds where quality/technical info starts in a string.
 */
function findQualityStart(str: string): number {
  const lower = str.toLowerCase();
  let earliestIndex = str.length;
  
  // Check for resolution patterns
  for (const pattern of Object.keys(RESOLUTIONS)) {
    const regex = new RegExp(`(?:^|[\\s.\\-_])${pattern}(?:[\\s.\\-_]|$)`, 'i');
    const match = lower.match(regex);
    if (match && match.index !== undefined && match.index < earliestIndex) {
      earliestIndex = match.index;
    }
  }
  
  // Check for source patterns
  for (const pattern of Object.keys(SOURCES)) {
    const regex = new RegExp(`(?:^|[\\s.\\-_])${pattern}(?:[\\s.\\-_]|$)`, 'i');
    const match = lower.match(regex);
    if (match && match.index !== undefined && match.index < earliestIndex) {
      earliestIndex = match.index;
    }
  }
  
  return earliestIndex;
}

/**
 * Extracts season and episode information.
 */
function extractEpisodeInfo(str: string): { season: number; episode: number; matchIndex: number; matchEnd: number } {
  for (const pattern of TV_PATTERNS) {
    const match = str.match(pattern);
    if (match && match.index !== undefined) {
      const groups = match.slice(1).filter((g): g is string => g !== undefined);
      
      // Handle different pattern group counts
      let season = 1;
      let episode = 0;
      
      if (groups.length >= 2 && groups[0] && groups[1]) {
        season = parseInt(groups[0], 10);
        episode = parseInt(groups[1], 10);
      } else if (groups.length >= 1 && groups[0]) {
        // Single number (anime style) - assume season 1
        episode = parseInt(groups[0], 10);
      }
      
      return {
        season,
        episode,
        matchIndex: match.index,
        matchEnd: match.index + match[0].length,
      };
    }
  }
  
  return { season: 0, episode: 0, matchIndex: -1, matchEnd: -1 };
}

/**
 * Extracts episode title from the portion after the episode number.
 */
function extractEpisodeTitle(str: string, afterEpisodeIndex: number): string {
  if (afterEpisodeIndex < 0 || afterEpisodeIndex >= str.length) {
    return '';
  }
  
  let afterEpisode = str.substring(afterEpisodeIndex);
  
  // Find where quality info starts
  const qualityIndex = findQualityStart(afterEpisode);
  if (qualityIndex > 0 && qualityIndex < afterEpisode.length) {
    afterEpisode = afterEpisode.substring(0, qualityIndex);
  }
  
  return afterEpisode;
}

/**
 * Parses anime-style filenames.
 */
function parseAnimeFormat(str: string): ParsedEpisode | null {
  for (const pattern of ANIME_PATTERNS) {
    const match = str.match(pattern);
    if (match) {
      // [Group] Title - Episode (4 groups: full match, group, title, episode)
      if (match.length >= 4 && match[2] && match[3]) {
        const title = match[2];
        const episode = parseInt(match[3], 10);
        
        return {
          showTitle: cleanTitle(title),
          seasonNumber: 1,
          episodeNumber: episode,
          episodeTitle: undefined,
          year: undefined,
          resolution: extractPattern(str, RESOLUTIONS),
        };
      }
      // Title - Episode (3 groups: full match, title, episode)
      if (match.length >= 3 && match[1] && match[2]) {
        const title = match[1];
        const episode = parseInt(match[2], 10);
        
        return {
          showTitle: cleanTitle(title),
          seasonNumber: 1,
          episodeNumber: episode,
          episodeTitle: undefined,
          year: undefined,
          resolution: extractPattern(str, RESOLUTIONS),
        };
      }
    }
  }
  
  return null;
}

/**
 * Cleans a title string by removing artifacts.
 */
function cleanTitle(title: string): string {
  if (!title) return '';
  
  let cleaned = title;
  
  // Remove brackets and their contents at the start (anime groups)
  cleaned = cleaned.replace(/^\[[^\]]*\]\s*/, '');
  
  // Remove year in various formats
  cleaned = cleaned.replace(/\s*\(\d{4}\)\s*/g, ' ');
  cleaned = cleaned.replace(/\s*\[\d{4}\]\s*/g, ' ');
  
  // Remove known terms (case-insensitive)
  for (const term of RELEASE_TERMS) {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi'), ' ');
  }
  for (const term of Object.keys(RESOLUTIONS)) {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi'), ' ');
  }
  for (const term of Object.keys(SOURCES)) {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi'), ' ');
  }
  for (const term of Object.keys(CODECS)) {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi'), ' ');
  }
  for (const term of AUDIO_CODECS) {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi'), ' ');
  }
  for (const term of SERVICES) {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi'), ' ');
  }
  
  // Remove release group at end
  cleaned = cleaned.replace(/-[A-Za-z0-9]+$/, '');
  
  // Remove trailing separators and whitespace
  cleaned = cleaned.replace(/[\s.\-_]+$/, '');
  cleaned = cleaned.replace(/^[\s.\-_]+/, '');
  
  // Remove empty brackets
  cleaned = cleaned.replace(/\(\s*\)/g, '');
  cleaned = cleaned.replace(/\[\s*\]/g, '');
  
  // Remove trailing open brackets
  cleaned = cleaned.replace(/\s*[\(\[]\s*$/, '');
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Cleans an episode title specifically.
 */
function cleanEpisodeTitle(title: string): string {
  if (!title) return '';
  
  let cleaned = cleanTitle(title);
  
  // Episode titles often have leading separators
  cleaned = cleaned.replace(/^[\s.\-_]+/, '');
  
  // Remove "Episode X" prefix if present
  cleaned = cleaned.replace(/^(?:Episode|EP|E)\s*\d+\s*[\-.:]\s*/i, '');
  
  return cleaned;
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
