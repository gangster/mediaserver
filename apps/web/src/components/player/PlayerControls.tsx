/**
 * Video player control bar component.
 *
 * Features:
 * - Play/pause button
 * - Progress bar with seek
 * - Volume control
 * - Playback speed
 * - Quality selector
 * - Fullscreen toggle
 * - Picture-in-Picture toggle
 * - Settings menu
 */

import React, { useCallback, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ProgressBar, type TrickplayData } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import type { BufferedRange, QualityLevel, PlayerHandle } from '@mediaserver/api-client';

/** Props for the PlayerControls component */
export interface PlayerControlsProps {
  /** Whether media is currently playing */
  isPlaying: boolean;
  /** Whether media is loading */
  isLoading: boolean;
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Buffered time ranges */
  bufferedRanges: BufferedRange[];
  /** Current volume (0-1) */
  volume: number;
  /** Whether audio is muted */
  muted: boolean;
  /** Current playback rate */
  playbackRate: number;
  /** Whether in fullscreen mode */
  isFullscreen: boolean;
  /** Whether in Picture-in-Picture mode */
  isPiP: boolean;
  /** Whether auto quality is enabled */
  autoQuality: boolean;
  /** Current quality level */
  currentQuality: QualityLevel | null;
  /** Available quality levels */
  availableQualities: QualityLevel[];
  /** Trickplay data for thumbnail preview */
  trickplay?: TrickplayData | null;
  /** Intro segment */
  intro?: { start: number; end: number };
  /** Credits segment */
  credits?: { start: number; end: number };
  /** Title to display */
  title?: string;
  /** Player handle for imperative control */
  playerRef: React.RefObject<PlayerHandle>;
  /** Callback when back button is pressed */
  onBack?: () => void;
  /** Callback when seek occurs */
  onSeek: (time: number) => void;
  /** Callback when seeking starts */
  onSeekStart?: () => void;
  /** Callback when seeking ends */
  onSeekEnd?: () => void;
}

/** Playback speed options */
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Video player control bar.
 */
export function PlayerControls({
  isPlaying,
  isLoading,
  currentTime,
  duration,
  bufferedRanges,
  volume,
  muted,
  playbackRate,
  isFullscreen,
  isPiP,
  autoQuality,
  currentQuality,
  availableQualities,
  trickplay,
  intro,
  credits,
  title,
  playerRef,
  onBack,
  onSeek,
  onSeekStart,
  onSeekEnd,
}: PlayerControlsProps) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  /**
   * Toggle play/pause
   */
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
  }, [isPlaying, playerRef]);

  /**
   * Handle volume change
   */
  const handleVolumeChange = useCallback(
    (vol: number) => {
      playerRef.current?.setVolume(vol);
    },
    [playerRef]
  );

  /**
   * Handle mute change
   */
  const handleMutedChange = useCallback(
    (m: boolean) => {
      playerRef.current?.setMuted(m);
    },
    [playerRef]
  );

  /**
   * Handle playback rate change
   */
  const handleSpeedChange = useCallback(
    (speed: number) => {
      playerRef.current?.setPlaybackRate(speed);
      setShowSpeedMenu(false);
    },
    [playerRef]
  );

  /**
   * Handle quality change
   */
  const handleQualityChange = useCallback(
    (levelIndex: number | 'auto') => {
      playerRef.current?.setQuality(levelIndex);
      setShowQualityMenu(false);
    },
    [playerRef]
  );

  /**
   * Toggle fullscreen
   */
  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      playerRef.current?.exitFullscreen();
    } else {
      playerRef.current?.enterFullscreen();
    }
  }, [isFullscreen, playerRef]);

  /**
   * Toggle Picture-in-Picture
   */
  const togglePiP = useCallback(() => {
    if (isPiP) {
      playerRef.current?.exitPiP();
    } else {
      playerRef.current?.enterPiP();
    }
  }, [isPiP, playerRef]);

  /**
   * Skip backward 10 seconds
   */
  const skipBackward = useCallback(() => {
    onSeek(Math.max(0, currentTime - 10));
  }, [currentTime, onSeek]);

  /**
   * Skip forward 10 seconds
   */
  const skipForward = useCallback(() => {
    onSeek(Math.min(duration, currentTime + 10));
  }, [currentTime, duration, onSeek]);

  return (
    <View
      className="absolute bottom-0 left-0 right-0 px-4 pb-4"
      style={{
        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        paddingTop: 48,
      } as const}
    >
      {/* Top row: Title and back button */}
      {(title || onBack) && (
        <View className="mb-3 flex flex-row items-center">
          {onBack && (
            <Pressable
              onPress={onBack}
              className="mr-3 p-1 hover:bg-white/10 rounded"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </Pressable>
          )}
          {title && (
            <Text className="text-white text-lg font-medium" numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>
      )}

      {/* Progress bar */}
      <ProgressBar
        currentTime={currentTime}
        duration={duration}
        bufferedRanges={bufferedRanges}
        trickplay={trickplay}
        intro={intro}
        credits={credits}
        onSeek={onSeek}
        onSeekStart={onSeekStart}
        onSeekEnd={onSeekEnd}
      />

      {/* Control row */}
      <View className="mt-2 flex flex-row items-center justify-between">
        {/* Left controls */}
        <View className="flex flex-row items-center gap-2">
          {/* Play/Pause */}
          <Pressable
            onPress={togglePlayPause}
            className="p-2 hover:bg-white/10 rounded-full"
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            disabled={isLoading}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color="white"
            />
          </Pressable>

          {/* Skip backward */}
          <Pressable
            onPress={skipBackward}
            className="p-2 hover:bg-white/10 rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Skip back 10 seconds"
          >
            <MaterialCommunityIcons
              name="rewind-10"
              size={24}
              color="white"
            />
          </Pressable>

          {/* Skip forward */}
          <Pressable
            onPress={skipForward}
            className="p-2 hover:bg-white/10 rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Skip forward 10 seconds"
          >
            <MaterialCommunityIcons
              name="fast-forward-10"
              size={24}
              color="white"
            />
          </Pressable>

          {/* Volume */}
          <VolumeControl
            volume={volume}
            muted={muted}
            onVolumeChange={handleVolumeChange}
            onMutedChange={handleMutedChange}
          />
        </View>

        {/* Right controls */}
        <View className="flex flex-row items-center gap-1">
          {/* Playback speed */}
          <View className="relative">
            <Pressable
              onPress={() => setShowSpeedMenu(!showSpeedMenu)}
              className="px-2 py-1 hover:bg-white/10 rounded"
              accessibilityRole="button"
              accessibilityLabel="Playback speed"
            >
              <Text className="text-white text-sm font-medium">
                {playbackRate}x
              </Text>
            </Pressable>

            {/* Speed menu */}
            {showSpeedMenu && (
              <View
                className="absolute bottom-full mb-2 right-0 bg-zinc-900 rounded-lg shadow-lg py-1 min-w-16"
                style={{ zIndex: 100 }}
              >
                {SPEED_OPTIONS.map((speed) => (
                  <Pressable
                    key={speed}
                    onPress={() => handleSpeedChange(speed)}
                    className={`px-3 py-2 hover:bg-white/10 ${
                      playbackRate === speed ? 'bg-indigo-600' : ''
                    }`}
                  >
                    <Text className="text-white text-sm">
                      {speed === 1 ? 'Normal' : `${speed}x`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Quality selector */}
          {availableQualities.length > 0 && (
            <View className="relative">
              <Pressable
                onPress={() => setShowQualityMenu(!showQualityMenu)}
                className="px-2 py-1 hover:bg-white/10 rounded"
                accessibilityRole="button"
                accessibilityLabel="Video quality"
              >
                <Text className="text-white text-sm font-medium">
                  {autoQuality ? 'Auto' : currentQuality?.label ?? 'Auto'}
                </Text>
              </Pressable>

              {/* Quality menu */}
              {showQualityMenu && (
                <View
                  className="absolute bottom-full mb-2 right-0 bg-zinc-900 rounded-lg shadow-lg py-1 min-w-24"
                  style={{ zIndex: 100 }}
                >
                  <Pressable
                    onPress={() => handleQualityChange('auto')}
                    className={`px-3 py-2 hover:bg-white/10 ${
                      autoQuality ? 'bg-indigo-600' : ''
                    }`}
                  >
                    <Text className="text-white text-sm">Auto</Text>
                  </Pressable>
                  {availableQualities.map((quality, index) => (
                    <Pressable
                      key={index}
                      onPress={() => handleQualityChange(index)}
                      className={`px-3 py-2 hover:bg-white/10 ${
                        !autoQuality && currentQuality?.height === quality.height
                          ? 'bg-indigo-600'
                          : ''
                      }`}
                    >
                      <Text className="text-white text-sm">{quality.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Picture-in-Picture */}
          <Pressable
            onPress={togglePiP}
            className="p-2 hover:bg-white/10 rounded"
            accessibilityRole="button"
            accessibilityLabel={isPiP ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
          >
            <MaterialCommunityIcons
              name={isPiP ? 'picture-in-picture-bottom-right-outline' : 'picture-in-picture-bottom-right'}
              size={22}
              color="white"
            />
          </Pressable>

          {/* Fullscreen */}
          <Pressable
            onPress={toggleFullscreen}
            className="p-2 hover:bg-white/10 rounded"
            accessibilityRole="button"
            accessibilityLabel={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <Ionicons
              name={isFullscreen ? 'contract' : 'expand'}
              size={22}
              color="white"
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default PlayerControls;
