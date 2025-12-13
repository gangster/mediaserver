/**
 * Formatting utilities for dates, times, runtime, and titles.
 */

/** Release terms to strip from titles */
const RELEASE_TERMS = [
  'REMASTERED', 'REPACK', 'PROPER', 'EXTENDED', 'UNRATED', 'DIRECTORS CUT',
  'THEATRICAL', 'IMAX', 'HDR', 'HDR10', 'DOLBY VISION', 'DV', 'HYBRID', '3D', 'REMUX',
  'BLURAY', 'BLU-RAY', 'BDRIP', 'BRRIP', 'BDREMUX', 'WEBDL', 'WEB-DL', 'WEBRIP', 'WEB-RIP',
  'HDTV', 'DVDRIP', 'DVDSCR', 'HDCAM', 'CAM', 'AMZN', 'NF', 'DSNP', 'HMAX', 'ATVP', 'PCOK', 'HULU',
  'X264', 'H264', 'H.264', 'AVC', 'X265', 'H265', 'H.265', 'HEVC', 'XVID', 'DIVX', 'VP9', 'AV1',
  'AAC', 'DTS', 'DTS-HD', 'DTSHD', 'TRUEHD', 'ATMOS', 'AC3', 'EAC3', 'FLAC', 'MP3', 'LPCM',
  '2160P', '1080P', '720P', '480P', '4K', 'UHD', 'SD',
];

/**
 * Normalize/clean a title string by removing release artifacts.
 * @example normalizeTitle("- The Rogue Prince Bluray-") => "The Rogue Prince"
 * @example normalizeTitle("The Banshees of Inisherin (") => "The Banshees of Inisherin"
 */
export function normalizeTitle(title: string | null | undefined): string {
  if (!title) return '';
  
  let cleaned = title;
  
  // Remove leading/trailing dashes, dots, underscores, whitespace, and parentheses
  cleaned = cleaned.replace(/^[\s\-–—._(\[]+|[\s\-–—._)\]]+$/g, '');
  
  // Remove release terms (case-insensitive)
  for (const term of RELEASE_TERMS) {
    cleaned = cleaned.replace(new RegExp(`\\b${term}\\b`, 'gi'), '');
  }
  
  // Remove release group at end (after dash)
  cleaned = cleaned.replace(/-[A-Za-z0-9]+$/, '');
  
  // Remove year patterns like (2022) or [2022]
  cleaned = cleaned.replace(/\s*[\(\[]?\d{4}[\)\]]?\s*$/, '');
  
  // Remove trailing/leading separators again after cleanup
  cleaned = cleaned.replace(/^[\s\-–—._(\[]+|[\s\-–—._)\]]+$/g, '');
  
  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned || title; // Return original if cleaned is empty
}

/**
 * Format a runtime in minutes to a human-readable string.
 * @example formatRuntime(125) => "2h 5m"
 */
export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format seconds to a time string (MM:SS or HH:MM:SS).
 * @example formatTime(3661) => "1:01:01"
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a date string to a localized date.
 * @example formatDate("2024-01-15") => "January 15, 2024"
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format a date string to a short date.
 * @example formatShortDate("2024-01-15") => "Jan 15, 2024"
 */
export function formatShortDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format a date string to a relative time.
 * @example formatRelativeDate("2024-01-15") => "2 days ago"
 */
export function formatRelativeDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return dateString;
  }
}

