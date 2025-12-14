/**
 * Video player UI types.
 * These types are used by the cross-platform video player components.
 */

/**
 * Player status with fine-grained buffering states.
 * Used to determine what UI to show.
 */
export type PlayerStatus =
  | 'idle' // No media loaded
  | 'loading' // Creating session, loading manifest
  | 'buffering' // Waiting for data (show spinner after 1s)
  | 'ready' // Paused with enough buffer
  | 'playing' // Active playback
  | 'seeking' // Seek in progress
  | 'paused' // User paused
  | 'ended' // Playback finished
  | 'error'; // Unrecoverable error

/**
 * Buffered range representing a contiguous buffered segment.
 */
export interface BufferedRange {
  start: number;
  end: number;
}

/**
 * Quality level for adaptive bitrate streaming.
 */
export interface QualityLevel {
  /** Video height in pixels */
  height: number;
  /** Bitrate in bits per second */
  bitrate: number;
  /** Human-readable label (e.g., "1080p", "720p") */
  label: string;
}

/**
 * Player error with recovery information.
 */
export interface PlayerError {
  /** Error category */
  code: 'network' | 'decode' | 'src_not_supported' | 'aborted' | 'session_expired' | 'unknown';
  /** Human-readable error message */
  message: string;
  /** Whether this error is fatal (cannot recover) */
  fatal: boolean;
  /** Whether this error can be retried */
  retryable: boolean;
  /** Number of retry attempts made */
  retryCount: number;
}

/**
 * Complete player state for UI rendering.
 */
export interface PlayerState {
  /** Current player status */
  status: PlayerStatus;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Array of buffered time ranges */
  bufferedRanges: BufferedRange[];
  /** Seconds buffered ahead of playhead */
  bufferedAhead: number;
  /** Volume level (0-1) */
  volume: number;
  /** Whether audio is muted */
  muted: boolean;
  /** Playback rate (0.5-2.0) */
  playbackRate: number;
  /** Whether player is in fullscreen mode */
  isFullscreen: boolean;
  /** Whether player is in Picture-in-Picture mode */
  isPiP: boolean;
  /** Current quality level (null if not yet determined) */
  currentQuality: QualityLevel | null;
  /** All available quality levels */
  availableQualities: QualityLevel[];
  /** Whether quality is set to auto (adaptive bitrate) */
  autoQuality: boolean;
  /** Current error if status is 'error' */
  error?: PlayerError;
}

/**
 * Trickplay sprite data for thumbnail seek previews.
 */
export interface TrickplayData {
  /** URL to the sprite sheet image */
  spriteUrl: string;
  /** Seconds between each thumbnail */
  interval: number;
  /** Width of each thumbnail in pixels */
  thumbnailWidth: number;
  /** Height of each thumbnail in pixels */
  thumbnailHeight: number;
  /** Number of thumbnail columns in sprite */
  columns: number;
  /** Number of thumbnail rows in sprite */
  rows: number;
  /** Total number of thumbnails in sprite */
  totalThumbnails: number;
}

/**
 * Next episode information for binge flow.
 */
export interface NextEpisodeInfo {
  /** Episode ID */
  episodeId: string;
  /** Parent show ID */
  showId: string;
  /** Season number */
  seasonNumber: number;
  /** Episode number within season */
  episodeNumber: number;
  /** Episode title */
  title: string;
  /** Thumbnail/still image URL */
  thumbnailUrl?: string;
  /** Episode duration in seconds */
  duration: number;
}

/**
 * Skip segments for intro and credits.
 */
export interface SkipSegments {
  /** Intro segment (title sequence) */
  intro?: {
    /** Start time in seconds */
    start: number;
    /** End time in seconds */
    end: number;
  };
  /** Credits segment */
  credits?: {
    /** Start time in seconds */
    start: number;
    /** End time in seconds */
    end: number;
  };
}

/**
 * Caption/subtitle styling options.
 */
export interface CaptionStyle {
  /** Font size */
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  /** Font family */
  fontFamily: 'default' | 'serif' | 'monospace';
  /** Text color (hex) */
  textColor: string;
  /** Background color (hex) */
  backgroundColor: string;
  /** Background opacity (0-1) */
  backgroundOpacity: number;
  /** Text edge style for readability */
  textEdge: 'none' | 'raised' | 'depressed' | 'outline' | 'dropshadow';
}

/**
 * Default caption style.
 */
export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 'medium',
  fontFamily: 'default',
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  backgroundOpacity: 0.75,
  textEdge: 'outline',
};

/**
 * User playback preferences (stored per-user).
 */
export interface UserPlaybackPreferences {
  /** Volume level (0-1) */
  volume?: number;
  /** Muted state */
  muted?: boolean;
  /** Preferred playback speed */
  playbackSpeed?: number;
  /** Auto-play next episode */
  autoplayNext?: boolean;
  /** Preferred quality (null = auto) */
  preferredQuality?: 'auto' | '2160p' | '1080p' | '720p' | '480p';
  /** Enable data saver on cellular */
  dataSaverOnCellular?: boolean;
  /** Enable captions by default */
  captionsEnabled?: boolean;
  /** Caption styling */
  captionStyle?: CaptionStyle;
  /** Preferred caption language (ISO 639-1) */
  preferredCaptionLanguage?: string;
  /** Show skip intro button */
  showSkipIntroButton?: boolean;
  /** Auto-skip intros */
  autoSkipIntro?: boolean;
  /** Show skip credits button */
  showSkipCreditsButton?: boolean;
  /** Auto-skip credits */
  autoSkipCredits?: boolean;
  /** Controls auto-hide delay in ms */
  controlsHideDelay?: number;
  /** Pause playback when tab is hidden */
  pauseWhenTabHidden?: boolean;
}

/**
 * Admin playback settings (server-wide).
 */
export interface AdminPlaybackSettings {
  /** Override autoplay next default */
  autoplayNext?: boolean;
  /** Override captions enabled default */
  defaultCaptionsEnabled?: boolean;
  /** Default caption language */
  defaultCaptionLanguage?: string;
  /** Show skip intro button */
  showSkipIntroButton?: boolean;
  /** Auto-skip intros */
  autoSkipIntro?: boolean;
  /** Maximum quality users can select */
  maxQualityAllowed?: 'auto' | '2160p' | '1080p' | '720p' | '480p';
  /** Allow background playback */
  allowBackgroundPlayback?: boolean;
  /** Allow playback speed changes */
  allowPlaybackSpeedChange?: boolean;
  /** Maximum playback speed */
  maxPlaybackSpeed?: number;
  /** Settings locked from user changes */
  lockedSettings?: string[];
}

/**
 * Resolved playback preferences after cascade.
 * (user overrides > admin settings > code defaults)
 */
export interface ResolvedPlaybackPreferences {
  volume: number;
  muted: boolean;
  playbackSpeed: number;
  autoplayNext: boolean;
  preferredQuality: 'auto' | '2160p' | '1080p' | '720p' | '480p';
  dataSaverOnCellular: boolean;
  captionsEnabled: boolean;
  captionStyle: CaptionStyle;
  preferredCaptionLanguage: string | null;
  showSkipIntroButton: boolean;
  autoSkipIntro: boolean;
  showSkipCreditsButton: boolean;
  autoSkipCredits: boolean;
  controlsHideDelay: number;
  pauseWhenTabHidden: boolean;
  resumeThreshold: number;
  markWatchedThreshold: number;
}

/**
 * Playback conflict when media is playing on another device.
 */
export interface PlaybackConflict {
  /** Device name where playback is active */
  deviceName: string;
  /** When playback started */
  startedAt: string;
  /** Session ID to end if user chooses to play here */
  sessionId: string;
}

/**
 * Network state for adaptive quality and offline handling.
 */
export interface NetworkState {
  /** Whether device is online */
  online: boolean;
  /** Effective connection type */
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | null;
  /** Estimated downlink speed in Mbps */
  downlink: number | null;
}

/**
 * Aspect ratio mode for video display.
 */
export type AspectRatioMode = 'fit' | 'fill' | 'stretch';
