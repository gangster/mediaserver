/**
 * Playback defaults - "factory settings" for the video player.
 *
 * These defaults are designed to be sensible for most households
 * with zero admin configuration required. Admin and users can
 * override these through the 3-tier preference cascade:
 *
 *   Code Defaults → Admin Settings → User Preferences
 *
 * @module
 */

import { DEFAULT_CAPTION_STYLE } from '../types/player.js';
import type { CaptionStyle } from '../types/player.js';

/**
 * Sensible playback defaults that work perfectly out-of-box.
 * No admin configuration required.
 */
export const PLAYBACK_DEFAULTS = {
  // Audio
  /** Default volume (100% - user controls their speakers) */
  volume: 1.0,
  /** Default mute state */
  muted: false,

  // Playback behavior
  /** Auto-play next episode (binge-friendly) */
  autoplayNext: true,
  /** Default playback speed */
  playbackSpeed: 1.0,

  // Quality
  /** Preferred quality (auto = adaptive bitrate) */
  preferredQuality: 'auto' as const,
  /** Enable data saver on cellular connections */
  dataSaverOnCellular: false,

  // Captions
  /** Enable captions by default (accessibility users enable) */
  captionsEnabled: false,
  /** Default caption styling */
  captionStyle: DEFAULT_CAPTION_STYLE as CaptionStyle,
  /** Preferred caption language (null = use media default) */
  preferredCaptionLanguage: null as string | null,

  // Skip behavior
  /** Show skip intro button (don't auto-skip) */
  showSkipIntroButton: true,
  /** Auto-skip intros (manual skip preferred) */
  autoSkipIntro: false,
  /** Show skip credits button */
  showSkipCreditsButton: true,
  /** Auto-skip credits */
  autoSkipCredits: false,

  // UI behavior
  /** Controls auto-hide delay in milliseconds */
  controlsHideDelay: 3000,
  /** Pause playback when browser tab is hidden */
  pauseWhenTabHidden: false,

  // Resume behavior
  /** Show resume prompt if position > this many seconds */
  resumeThreshold: 30,
  /** Mark as watched when this percentage is reached */
  markWatchedThreshold: 0.9,
} as const;

/**
 * Type representing the playback defaults.
 */
export type PlaybackDefaults = typeof PLAYBACK_DEFAULTS;

/**
 * Quality levels in order from highest to lowest.
 * Used for clamping user quality preferences to admin limits.
 */
export const QUALITY_ORDER = ['2160p', '1080p', '720p', '480p', 'auto'] as const;

/**
 * Clamp a quality preference to respect admin limits.
 * @param userQuality - User's preferred quality
 * @param maxQuality - Admin's maximum allowed quality
 * @returns The clamped quality value
 */
export function clampQuality(
  userQuality: string,
  maxQuality: string
): 'auto' | '2160p' | '1080p' | '720p' | '480p' {
  if (userQuality === 'auto' || maxQuality === 'auto') {
    return userQuality as 'auto' | '2160p' | '1080p' | '720p' | '480p';
  }

  const userIndex = QUALITY_ORDER.indexOf(userQuality as (typeof QUALITY_ORDER)[number]);
  const maxIndex = QUALITY_ORDER.indexOf(maxQuality as (typeof QUALITY_ORDER)[number]);

  // If user quality is higher than max, clamp to max
  if (userIndex < maxIndex) {
    return maxQuality as '2160p' | '1080p' | '720p' | '480p';
  }

  return userQuality as '2160p' | '1080p' | '720p' | '480p';
}
