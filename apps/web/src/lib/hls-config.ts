/**
 * Tuned hls.js configuration for premium playback experience.
 *
 * These settings prioritize:
 * - Fast start (begin with lower quality, ramp up)
 * - Smooth playback (avoid rebuffering)
 * - Quality stability (conservative bandwidth usage)
 */

import type Hls from 'hls.js';
import { getAccessToken } from '../stores/auth';

/**
 * Create HLS config with auth support.
 * The xhrSetup adds Authorization header to all HLS requests.
 */
export async function createHlsConfig(dataSaver = false): Promise<Partial<Hls['config']>> {
  const token = await getAccessToken();
  const baseConfig = dataSaver ? hlsDataSaverConfig : hlsConfig;
  
  return {
    ...baseConfig,
    xhrSetup: (xhr: XMLHttpRequest) => {
      // Add auth token to all HLS requests
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
    },
  };
}

/**
 * Optimized hls.js configuration.
 * 
 * NOTE: We use EVENT playlists for live transcoding, but we want VOD-like behavior.
 * Key settings to achieve this:
 * - liveSyncDuration: Set high to start from beginning, not live edge
 * - liveBackBufferLength: Keep all content behind playhead
 */
export const hlsConfig: Partial<Hls['config']> = {
  // Fast start: auto-select level based on bandwidth
  startLevel: -1, // Auto
  autoStartLoad: true,

  // ABR tuning for smooth quality transitions
  abrEwmaDefaultEstimate: 500000, // 500kbps initial estimate
  abrBandWidthFactor: 0.95, // Conservative bandwidth usage
  abrBandWidthUpFactor: 0.7, // Slower quality increases (prevent thrashing)

  // Buffer settings for smooth playback
  maxBufferLength: 30, // Buffer 30s ahead
  maxMaxBufferLength: 60, // Can grow to 60s
  maxBufferSize: 60 * 1000 * 1000, // 60MB max buffer
  maxBufferHole: 0.5, // Tolerate small gaps (FFmpeg segments may not align perfectly)
  
  // Buffer stall handling - helps with transcoded streams that may have small gaps
  highBufferWatchdogPeriod: 3, // Check for stalls every 3s when buffer is healthy
  maxStarvationDelay: 4, // Wait 4s before forcing quality down

  // Back buffer settings
  backBufferLength: Infinity, // Keep ALL content behind playhead (VOD behavior)

  // Low latency settings (disabled)
  lowLatencyMode: false,

  // Error recovery
  fragLoadingMaxRetry: 4,
  manifestLoadingMaxRetry: 4,
  levelLoadingMaxRetry: 4,
  fragLoadingRetryDelay: 1000,
  manifestLoadingRetryDelay: 1000,
  levelLoadingRetryDelay: 1000,

  // Timeouts
  fragLoadingTimeOut: 20000, // 20s for fragment load
  manifestLoadingTimeOut: 10000, // 10s for manifest load
  levelLoadingTimeOut: 10000, // 10s for level load

  // Seeking behavior
  nudgeOffset: 0.1, // Small nudge when stuck
  nudgeMaxRetry: 3,

  // CRITICAL: For EVENT playlists used during transcoding
  // These settings make HLS.js behave like VOD instead of live:
  liveSyncDuration: 9999, // Don't sync to live edge - start from beginning
  liveMaxLatencyDuration: 99999, // Must be > liveSyncDuration
  liveDurationInfinity: false, // Don't treat as infinite duration
  
  // Prefer native code path when available
  enableWorker: true,
};

/**
 * Data saver configuration (for mobile/metered connections).
 * Caps quality to 720p and uses more conservative buffering.
 */
export const hlsDataSaverConfig: Partial<Hls['config']> = {
  ...hlsConfig,
  abrEwmaDefaultEstimate: 200000, // 200kbps initial estimate
  maxBufferLength: 15, // Less buffering to save data
  maxMaxBufferLength: 30,
  maxBufferSize: 30 * 1000 * 1000, // 30MB max buffer
};

/**
 * Quality levels to display in UI.
 * Maps hls.js level heights to user-friendly labels.
 */
export const qualityLabels: Record<number, string> = {
  2160: '4K',
  1440: '1440p',
  1080: '1080p',
  720: '720p',
  480: '480p',
  360: '360p',
  240: '240p',
  144: '144p',
};

/**
 * Quality tier thresholds for widescreen content.
 * Videos are classified by their height, but with ranges to handle
 * different aspect ratios (e.g., 1920x804 for 2.39:1 cinema is still "1080p")
 */
const qualityTiers = [
  { minHeight: 1800, label: '4K' },      // 4K (2160p) - anything >= 1800
  { minHeight: 1200, label: '1440p' },   // 1440p - anything >= 1200
  { minHeight: 800, label: '1080p' },    // 1080p - anything >= 800 (handles 2.39:1 at 804)
  { minHeight: 600, label: '720p' },     // 720p - anything >= 600
  { minHeight: 400, label: '480p' },     // 480p - anything >= 400
  { minHeight: 280, label: '360p' },     // 360p - anything >= 280
  { minHeight: 180, label: '240p' },     // 240p - anything >= 180
  { minHeight: 0, label: '144p' },       // 144p - anything else
];

/**
 * Get a user-friendly label for a quality level.
 * Handles widescreen content where height may be reduced due to aspect ratio.
 */
export function getQualityLabel(height: number): string {
  // Find exact match first
  if (qualityLabels[height]) {
    return qualityLabels[height];
  }

  // Use tier-based matching for widescreen content
  for (const tier of qualityTiers) {
    if (height >= tier.minHeight) {
      return tier.label;
    }
  }

  return `${height}p`;
}
