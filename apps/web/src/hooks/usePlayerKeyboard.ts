/**
 * Keyboard shortcuts hook for the video player.
 *
 * Shortcuts:
 * - Space/K: Play/Pause
 * - ←/J: Seek back 10s
 * - →/L: Seek forward 10s
 * - ↑: Volume up 10%
 * - ↓: Volume down 10%
 * - M: Toggle mute
 * - F: Toggle fullscreen
 * - Escape: Exit fullscreen/close menu
 * - P: Toggle Picture-in-Picture
 * - C: Toggle captions
 * - </> : Playback speed
 * - 0-9: Seek to 0%-90%
 * - N: Next episode (when visible)
 * - Home: Seek to start
 * - End: Seek to end
 * - ?: Show keyboard shortcuts help
 */

import { useCallback, useEffect, useState } from 'react';
import type { PlayerHandle } from '@mediaserver/api-client';

/** Keyboard shortcut action types */
export type KeyboardAction =
  | 'play_pause'
  | 'seek_back'
  | 'seek_forward'
  | 'volume_up'
  | 'volume_down'
  | 'toggle_mute'
  | 'toggle_fullscreen'
  | 'exit_fullscreen'
  | 'toggle_pip'
  | 'toggle_captions'
  | 'speed_up'
  | 'speed_down'
  | 'seek_percent'
  | 'next_episode'
  | 'seek_start'
  | 'seek_end'
  | 'show_help';

/** Options for the keyboard shortcuts hook */
export interface UsePlayerKeyboardOptions {
  /** Player handle ref */
  playerRef: React.RefObject<PlayerHandle>;
  /** Current player state */
  isPlaying: boolean;
  /** Current volume (0-1) */
  volume: number;
  /** Whether audio is muted */
  muted: boolean;
  /** Current playback rate */
  playbackRate: number;
  /** Whether in fullscreen */
  isFullscreen: boolean;
  /** Media duration in seconds */
  duration: number;
  /** Current time in seconds */
  currentTime: number;
  /** Whether keyboard shortcuts are enabled */
  enabled?: boolean;
  /** Callback when seek occurs */
  onSeek?: (time: number) => void;
  /** Callback for next episode */
  onNextEpisode?: () => void;
  /** Callback when help should be shown */
  onShowHelp?: () => void;
  /** Callback when captions should be toggled */
  onToggleCaptions?: () => void;
}

/** Return type for the keyboard shortcuts hook */
export interface UsePlayerKeyboardReturn {
  /** Whether help dialog is open */
  showHelp: boolean;
  /** Close help dialog */
  closeHelp: () => void;
  /** Open help dialog */
  openHelp: () => void;
}

/** Playback speed options */
const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * Hook for handling keyboard shortcuts in the video player.
 */
export function usePlayerKeyboard({
  playerRef,
  isPlaying,
  volume,
  muted,
  playbackRate,
  isFullscreen,
  duration,
  currentTime,
  enabled = true,
  onSeek,
  onNextEpisode,
  onShowHelp,
  onToggleCaptions,
}: UsePlayerKeyboardOptions): UsePlayerKeyboardReturn {
  const [showHelp, setShowHelp] = useState(false);

  /**
   * Handle keyboard event.
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle if disabled
      if (!enabled) return;

      // Don't handle if typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const player = playerRef.current;
      if (!player) return;

      // Handle shortcuts
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          if (isPlaying) {
            player.pause();
          } else {
            player.play();
          }
          break;

        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          onSeek?.(Math.max(0, currentTime - 10));
          break;

        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          onSeek?.(Math.min(duration, currentTime + 10));
          break;

        case 'ArrowUp':
          e.preventDefault();
          player.setVolume(Math.min(1, volume + 0.1));
          if (muted) {
            player.setMuted(false);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          player.setVolume(Math.max(0, volume - 0.1));
          break;

        case 'm':
        case 'M':
          e.preventDefault();
          player.setMuted(!muted);
          break;

        case 'f':
        case 'F':
          e.preventDefault();
          if (isFullscreen) {
            player.exitFullscreen();
          } else {
            player.enterFullscreen();
          }
          break;

        case 'Escape':
          if (isFullscreen) {
            player.exitFullscreen();
          } else if (showHelp) {
            setShowHelp(false);
          }
          break;

        case 'p':
        case 'P':
          e.preventDefault();
          player.enterPiP().catch(() => {
            // PiP not supported or denied
          });
          break;

        case 'c':
        case 'C':
          e.preventDefault();
          onToggleCaptions?.();
          break;

        case '<':
        case ',':
          e.preventDefault();
          {
            const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
            const newSpeed = SPEED_OPTIONS[currentIndex - 1];
            if (currentIndex > 0 && newSpeed !== undefined) {
              player.setPlaybackRate(newSpeed);
            }
          }
          break;

        case '>':
        case '.':
          e.preventDefault();
          {
            const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
            const newSpeed = SPEED_OPTIONS[currentIndex + 1];
            if (currentIndex < SPEED_OPTIONS.length - 1 && newSpeed !== undefined) {
              player.setPlaybackRate(newSpeed);
            } else if (currentIndex === -1) {
              // Current speed not in list, go to 1x
              player.setPlaybackRate(1);
            }
          }
          break;

        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          {
            const percent = parseInt(e.key, 10) / 10;
            onSeek?.(duration * percent);
          }
          break;

        case 'n':
        case 'N':
          e.preventDefault();
          onNextEpisode?.();
          break;

        case 'Home':
          e.preventDefault();
          onSeek?.(0);
          break;

        case 'End':
          e.preventDefault();
          onSeek?.(duration);
          break;

        case '?':
          e.preventDefault();
          setShowHelp((prev) => !prev);
          onShowHelp?.();
          break;

        default:
          // Unknown key, don't prevent default
          break;
      }
    },
    [
      enabled,
      playerRef,
      isPlaying,
      volume,
      muted,
      playbackRate,
      isFullscreen,
      duration,
      currentTime,
      showHelp,
      onSeek,
      onNextEpisode,
      onShowHelp,
      onToggleCaptions,
    ]
  );

  // Add event listener
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    showHelp,
    closeHelp: () => setShowHelp(false),
    openHelp: () => setShowHelp(true),
  };
}

/**
 * Keyboard shortcuts help data for displaying in UI.
 */
export const KEYBOARD_SHORTCUTS = [
  { key: 'Space / K', description: 'Play/Pause' },
  { key: '← / J', description: 'Seek back 10s' },
  { key: '→ / L', description: 'Seek forward 10s' },
  { key: '↑', description: 'Volume up' },
  { key: '↓', description: 'Volume down' },
  { key: 'M', description: 'Toggle mute' },
  { key: 'F', description: 'Toggle fullscreen' },
  { key: 'Escape', description: 'Exit fullscreen' },
  { key: 'P', description: 'Picture-in-Picture' },
  { key: 'C', description: 'Toggle captions' },
  { key: '< / >', description: 'Playback speed' },
  { key: '0-9', description: 'Seek to 0%-90%' },
  { key: 'N', description: 'Next episode' },
  { key: 'Home', description: 'Seek to start' },
  { key: 'End', description: 'Seek to end' },
  { key: '?', description: 'Show this help' },
];

export default usePlayerKeyboard;
