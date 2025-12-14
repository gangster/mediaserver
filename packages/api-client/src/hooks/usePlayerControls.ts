/**
 * Player controls hook for managing video player state.
 *
 * Provides unified state management and control functions for
 * the video player across web and native platforms.
 */

import { useCallback, useReducer, useRef } from 'react';

/** Player status */
export type PlayerStatus =
  | 'idle'
  | 'loading'
  | 'buffering'
  | 'ready'
  | 'playing'
  | 'seeking'
  | 'paused'
  | 'ended'
  | 'error';

/** Buffered range */
export interface BufferedRange {
  start: number;
  end: number;
}

/** Quality level */
export interface QualityLevel {
  height: number;
  bitrate: number;
  label: string;
}

/** Player error */
export interface PlayerError {
  code: 'network' | 'decode' | 'src_not_supported' | 'aborted' | 'session_expired' | 'unknown';
  message: string;
  fatal: boolean;
  retryable: boolean;
  retryCount: number;
}

/** Player state */
export interface PlayerState {
  status: PlayerStatus;
  currentTime: number;
  duration: number;
  bufferedRanges: BufferedRange[];
  bufferedAhead: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  isPiP: boolean;
  currentQuality: QualityLevel | null;
  availableQualities: QualityLevel[];
  autoQuality: boolean;
  error?: PlayerError;
}

/** Initial player state */
const initialState: PlayerState = {
  status: 'idle',
  currentTime: 0,
  duration: 0,
  bufferedRanges: [],
  bufferedAhead: 0,
  volume: 1,
  muted: false,
  playbackRate: 1,
  isFullscreen: false,
  isPiP: false,
  currentQuality: null,
  availableQualities: [],
  autoQuality: true,
  error: undefined,
};

/** Action types */
type PlayerAction =
  | { type: 'SET_STATUS'; status: PlayerStatus }
  | { type: 'SET_TIME'; currentTime: number }
  | { type: 'SET_DURATION'; duration: number }
  | { type: 'SET_BUFFERED'; ranges: BufferedRange[]; bufferedAhead: number }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SET_MUTED'; muted: boolean }
  | { type: 'SET_PLAYBACK_RATE'; rate: number }
  | { type: 'SET_FULLSCREEN'; isFullscreen: boolean }
  | { type: 'SET_PIP'; isPiP: boolean }
  | { type: 'SET_QUALITY'; quality: QualityLevel | null }
  | { type: 'SET_QUALITIES'; qualities: QualityLevel[] }
  | { type: 'SET_AUTO_QUALITY'; auto: boolean }
  | { type: 'SET_ERROR'; error: PlayerError }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

/** State reducer */
function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SET_TIME':
      return { ...state, currentTime: action.currentTime };
    case 'SET_DURATION':
      return { ...state, duration: action.duration };
    case 'SET_BUFFERED':
      return {
        ...state,
        bufferedRanges: action.ranges,
        bufferedAhead: action.bufferedAhead,
      };
    case 'SET_VOLUME':
      return { ...state, volume: action.volume };
    case 'SET_MUTED':
      return { ...state, muted: action.muted };
    case 'SET_PLAYBACK_RATE':
      return { ...state, playbackRate: action.rate };
    case 'SET_FULLSCREEN':
      return { ...state, isFullscreen: action.isFullscreen };
    case 'SET_PIP':
      return { ...state, isPiP: action.isPiP };
    case 'SET_QUALITY':
      return { ...state, currentQuality: action.quality };
    case 'SET_QUALITIES':
      return { ...state, availableQualities: action.qualities };
    case 'SET_AUTO_QUALITY':
      return { ...state, autoQuality: action.auto };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.error };
    case 'CLEAR_ERROR':
      return { ...state, error: undefined };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

/** Options for the player controls hook */
export interface UsePlayerControlsOptions {
  /** Initial volume (0-1) */
  initialVolume?: number;
  /** Initial muted state */
  initialMuted?: boolean;
  /** Initial playback rate */
  initialPlaybackRate?: number;
}

/** Handle for imperative player control */
export interface PlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setQuality: (levelIndex: number | 'auto') => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  enterPiP: () => Promise<void>;
  exitPiP: () => Promise<void>;
  /**
   * Reload the HLS source.
   * Used after server-side seek to load the new playlist.
   * @param newStartTime - Optional new start time to seek to after reload
   */
  reloadSource: (newStartTime?: number) => void | Promise<void>;
}

/** Return type for the player controls hook */
export interface UsePlayerControlsReturn {
  /** Current player state */
  state: PlayerState;

  // State updaters (called by video element events)
  /** Update player status */
  setStatus: (status: PlayerStatus) => void;
  /** Update current time */
  setCurrentTime: (time: number) => void;
  /** Update duration */
  setDuration: (duration: number) => void;
  /** Update buffered ranges */
  setBuffered: (ranges: BufferedRange[]) => void;
  /** Update volume */
  setVolume: (volume: number) => void;
  /** Update muted state */
  setMuted: (muted: boolean) => void;
  /** Update playback rate */
  setPlaybackRate: (rate: number) => void;
  /** Update fullscreen state */
  setFullscreen: (isFullscreen: boolean) => void;
  /** Update PiP state */
  setPiP: (isPiP: boolean) => void;
  /** Update current quality */
  setCurrentQuality: (quality: QualityLevel | null) => void;
  /** Update available qualities */
  setAvailableQualities: (qualities: QualityLevel[]) => void;
  /** Set auto quality mode */
  setAutoQuality: (auto: boolean) => void;
  /** Set player error */
  setError: (error: PlayerError) => void;
  /** Clear player error */
  clearError: () => void;
  /** Reset to initial state */
  reset: () => void;

  // Computed values
  /** Whether media is playing */
  isPlaying: boolean;
  /** Whether media is loading */
  isLoading: boolean;
  /** Whether media is buffering */
  isBuffering: boolean;
  /** Whether playback has ended */
  hasEnded: boolean;
  /** Whether there's an error */
  hasError: boolean;
  /** Progress percentage (0-100) */
  progress: number;

  // Ref for imperative player handle
  playerRef: React.MutableRefObject<PlayerHandle | null>;
}

/**
 * Hook for managing video player state and controls.
 */
export function usePlayerControls(
  options: UsePlayerControlsOptions = {}
): UsePlayerControlsReturn {
  const { initialVolume = 1, initialMuted = false, initialPlaybackRate = 1 } = options;

  // Player state
  const [state, dispatch] = useReducer(playerReducer, {
    ...initialState,
    volume: initialVolume,
    muted: initialMuted,
    playbackRate: initialPlaybackRate,
  });

  // Ref for imperative player control
  const playerRef = useRef<PlayerHandle | null>(null);

  // State updaters
  const setStatus = useCallback((status: PlayerStatus) => {
    dispatch({ type: 'SET_STATUS', status });
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    dispatch({ type: 'SET_TIME', currentTime: time });
  }, []);

  const setDuration = useCallback((duration: number) => {
    dispatch({ type: 'SET_DURATION', duration });
  }, []);

  const setBuffered = useCallback(
    (ranges: BufferedRange[]) => {
      // Calculate buffered ahead of current playhead
      let bufferedAhead = 0;
      const currentTime = state.currentTime;
      for (const range of ranges) {
        if (range.start <= currentTime && range.end > currentTime) {
          bufferedAhead = range.end - currentTime;
          break;
        }
      }
      dispatch({ type: 'SET_BUFFERED', ranges, bufferedAhead });
    },
    [state.currentTime]
  );

  const setVolume = useCallback((volume: number) => {
    dispatch({ type: 'SET_VOLUME', volume: Math.max(0, Math.min(1, volume)) });
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    dispatch({ type: 'SET_MUTED', muted });
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    dispatch({ type: 'SET_PLAYBACK_RATE', rate: Math.max(0.25, Math.min(3, rate)) });
  }, []);

  const setFullscreen = useCallback((isFullscreen: boolean) => {
    dispatch({ type: 'SET_FULLSCREEN', isFullscreen });
  }, []);

  const setPiP = useCallback((isPiP: boolean) => {
    dispatch({ type: 'SET_PIP', isPiP });
  }, []);

  const setCurrentQuality = useCallback((quality: QualityLevel | null) => {
    dispatch({ type: 'SET_QUALITY', quality });
  }, []);

  const setAvailableQualities = useCallback((qualities: QualityLevel[]) => {
    dispatch({ type: 'SET_QUALITIES', qualities });
  }, []);

  const setAutoQuality = useCallback((auto: boolean) => {
    dispatch({ type: 'SET_AUTO_QUALITY', auto });
  }, []);

  const setError = useCallback((error: PlayerError) => {
    dispatch({ type: 'SET_ERROR', error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Computed values
  const isPlaying = state.status === 'playing';
  const isLoading = state.status === 'loading';
  const isBuffering = state.status === 'buffering';
  const hasEnded = state.status === 'ended';
  const hasError = state.status === 'error';
  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return {
    state,
    setStatus,
    setCurrentTime,
    setDuration,
    setBuffered,
    setVolume,
    setMuted,
    setPlaybackRate,
    setFullscreen,
    setPiP,
    setCurrentQuality,
    setAvailableQualities,
    setAutoQuality,
    setError,
    clearError,
    reset,
    isPlaying,
    isLoading,
    isBuffering,
    hasEnded,
    hasError,
    progress,
    playerRef,
  };
}
