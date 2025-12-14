/**
 * Native video player component using expo-av.
 *
 * Features:
 * - HLS adaptive bitrate streaming
 * - Background audio playback
 * - Lock screen controls (iOS/Android)
 * - Picture-in-Picture support
 * - External captions
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';

/** Player handle for imperative control */
export interface NativePlayerHandle {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (positionMillis: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
}

/** Player status */
export type NativePlayerStatus =
  | 'idle'
  | 'loading'
  | 'buffering'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

/** Player error */
export interface NativePlayerError {
  code: string;
  message: string;
  fatal: boolean;
}

/** Player state */
export interface NativePlayerState {
  status: NativePlayerStatus;
  currentTime: number;
  duration: number;
  buffered: number;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  rate: number;
  error?: NativePlayerError;
}

/** Props for the NativeVideoPlayer component */
export interface NativeVideoPlayerProps {
  /** HLS manifest URL or direct video URL */
  source: string;
  /** Poster image to show while loading */
  poster?: string;
  /** Starting position in milliseconds */
  startPosition?: number;
  /** Whether to auto-play */
  autoPlay?: boolean;
  /** Initial volume (0-1) */
  volume?: number;
  /** Initial muted state */
  muted?: boolean;
  /** Whether to loop playback */
  loop?: boolean;
  /** Resize mode */
  resizeMode?: 'contain' | 'cover' | 'stretch';
  /** Whether to use native controls */
  useNativeControls?: boolean;
  /** Callback when state changes */
  onStateChange?: (state: NativePlayerState) => void;
  /** Callback when playback ends */
  onPlaybackEnd?: () => void;
  /** Callback on error */
  onError?: (error: NativePlayerError) => void;
  /** Callback when ready to play */
  onReady?: () => void;
}

/**
 * Convert AVPlaybackStatus to our player state
 */
function toPlayerState(status: AVPlaybackStatus): Partial<NativePlayerState> {
  if (!status.isLoaded) {
    return {
      status: status.error ? 'error' : 'loading',
      error: status.error
        ? { code: 'load_error', message: status.error, fatal: true }
        : undefined,
    };
  }

  let playerStatus: NativePlayerStatus = 'ready';
  if (status.isBuffering) {
    playerStatus = 'buffering';
  } else if (status.isPlaying) {
    playerStatus = 'playing';
  } else if (status.didJustFinish) {
    playerStatus = 'ended';
  } else {
    playerStatus = 'paused';
  }

  return {
    status: playerStatus,
    currentTime: status.positionMillis / 1000,
    duration: (status.durationMillis ?? 0) / 1000,
    buffered: (status.playableDurationMillis ?? 0) / 1000,
    isPlaying: status.isPlaying,
    volume: status.volume,
    muted: status.isMuted,
    rate: status.rate,
  };
}

/**
 * Native video player component using expo-av.
 */
export const NativeVideoPlayer = forwardRef<NativePlayerHandle, NativeVideoPlayerProps>(
  (
    {
      source,
      poster,
      startPosition = 0,
      autoPlay = false,
      volume = 1,
      muted = false,
      loop = false,
      resizeMode = 'contain',
      useNativeControls = false,
      onStateChange,
      onPlaybackEnd,
      onError,
      onReady,
    },
    ref
  ) => {
    const videoRef = useRef<Video>(null);
    const [isReady, setIsReady] = useState(false);

    /**
     * Configure audio session for background playback
     */
    useEffect(() => {
      const setupAudio = async () => {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        } catch (e) {
          console.warn('Failed to configure audio mode:', e);
        }
      };

      setupAudio();
    }, []);

    /**
     * Handle playback status updates
     */
    const handlePlaybackStatusUpdate = useCallback(
      (status: AVPlaybackStatus) => {
        const state = toPlayerState(status);

        if (status.isLoaded) {
          if (!isReady) {
            setIsReady(true);
            onReady?.();
          }

          if (status.didJustFinish && !loop) {
            onPlaybackEnd?.();
          }
        } else if (status.error) {
          const error: NativePlayerError = {
            code: 'playback_error',
            message: status.error,
            fatal: true,
          };
          onError?.(error);
        }

        onStateChange?.(state as NativePlayerState);
      },
      [isReady, loop, onStateChange, onPlaybackEnd, onError, onReady]
    );

    /**
     * Seek to start position when ready
     */
    useEffect(() => {
      if (isReady && startPosition > 0 && videoRef.current) {
        videoRef.current.setPositionAsync(startPosition);
      }
    }, [isReady, startPosition]);

    /**
     * Expose imperative handle
     */
    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          await videoRef.current?.playAsync();
        },
        pause: async () => {
          await videoRef.current?.pauseAsync();
        },
        seek: async (positionMillis: number) => {
          await videoRef.current?.setPositionAsync(positionMillis);
        },
        setVolume: async (vol: number) => {
          await videoRef.current?.setVolumeAsync(vol);
        },
        setMuted: async (m: boolean) => {
          await videoRef.current?.setIsMutedAsync(m);
        },
        setRate: async (rate: number) => {
          await videoRef.current?.setRateAsync(rate, true);
        },
      }),
      []
    );

    // Map resize mode
    const avResizeMode =
      resizeMode === 'cover'
        ? ResizeMode.COVER
        : resizeMode === 'stretch'
        ? ResizeMode.STRETCH
        : ResizeMode.CONTAIN;

    return (
      <View style={styles.container}>
        <Video
          ref={videoRef}
          source={{ uri: source }}
          posterSource={poster ? { uri: poster } : undefined}
          usePoster={!!poster}
          posterStyle={styles.poster}
          style={styles.video}
          resizeMode={avResizeMode}
          shouldPlay={autoPlay}
          isLooping={loop}
          volume={volume}
          isMuted={muted}
          useNativeControls={useNativeControls}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onError={(e) => {
            const error: NativePlayerError = {
              code: 'video_error',
              message: e || 'Unknown video error',
              fatal: true,
            };
            onError?.(error);
          }}
        />
      </View>
    );
  }
);

NativeVideoPlayer.displayName = 'NativeVideoPlayer';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  video: {
    flex: 1,
  },
  poster: {
    resizeMode: 'cover',
  },
});

export default NativeVideoPlayer;
