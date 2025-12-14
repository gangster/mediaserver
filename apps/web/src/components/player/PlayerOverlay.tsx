/**
 * Video player overlay for displaying loading, error, and end states.
 *
 * States:
 * - Loading: Spinner (shown after 1s delay to avoid flicker)
 * - Error: Error message with retry button
 * - Ended: Replay button for movies, next episode countdown for TV
 * - Network Lost: Connection lost message with buffer status
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spinner } from '../../components/ui';

/** Next episode information */
export interface NextEpisode {
  episodeId: string;
  showId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  thumbnailUrl?: string;
  duration: number;
}

/** Player error */
export interface PlayerError {
  code: string;
  message: string;
  fatal: boolean;
  retryable: boolean;
  retryCount: number;
}

/** Props for the PlayerOverlay component */
export interface PlayerOverlayProps {
  /** Whether media is loading */
  isLoading: boolean;
  /** Whether media is buffering */
  isBuffering: boolean;
  /** Whether playback has ended */
  hasEnded: boolean;
  /** Current error, if any */
  error?: PlayerError | null;
  /** Whether network is offline */
  isOffline?: boolean;
  /** Seconds of buffer remaining (when offline) */
  bufferRemaining?: number;
  /** Media type */
  mediaType: 'movie' | 'episode';
  /** Media title */
  title?: string;
  /** Next episode (for TV shows) */
  nextEpisode?: NextEpisode | null;
  /** Auto-play countdown duration in seconds */
  countdownDuration?: number;
  /** Callback when retry is requested */
  onRetry?: () => void;
  /** Callback when replay is requested */
  onReplay?: () => void;
  /** Callback when next episode is requested */
  onNextEpisode?: () => void;
  /** Callback when user cancels next episode countdown */
  onCancelNextEpisode?: () => void;
  /** Callback to navigate back */
  onBack?: () => void;
}

/**
 * Format seconds to human-readable string (e.g., "23s remaining").
 */
function formatBufferTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s remaining`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s remaining`;
}

/**
 * Loading overlay with spinner.
 */
function LoadingOverlay() {
  return (
    <View className="flex items-center justify-center">
      <Spinner size="large" className="text-white" />
      <Text className="mt-4 text-white text-lg">Loading...</Text>
    </View>
  );
}

/**
 * Buffering overlay with spinner.
 */
function BufferingOverlay() {
  return (
    <View className="flex items-center justify-center">
      <Spinner size="large" className="text-white" />
    </View>
  );
}

/**
 * Error overlay with retry button.
 */
function ErrorOverlay({
  error,
  onRetry,
  onBack,
}: {
  error: PlayerError;
  onRetry?: () => void;
  onBack?: () => void;
}) {
  return (
    <View className="flex items-center justify-center p-6">
      <View className="bg-black/80 rounded-xl p-6 max-w-md">
        <View className="flex items-center mb-4">
          <Ionicons name="warning" size={48} color="#ef4444" />
        </View>
        <Text className="text-white text-xl font-semibold text-center mb-2">
          Playback Error
        </Text>
        <Text className="text-white/70 text-center mb-6">
          {error.message}
        </Text>
        <View className="flex flex-row gap-3 justify-center">
          {error.retryable && onRetry && (
            <Pressable
              onPress={onRetry}
              className="bg-indigo-600 px-6 py-3 rounded-lg hover:bg-indigo-500"
            >
              <Text className="text-white font-medium">Retry</Text>
            </Pressable>
          )}
          {onBack && (
            <Pressable
              onPress={onBack}
              className="bg-zinc-700 px-6 py-3 rounded-lg hover:bg-zinc-600"
            >
              <Text className="text-white font-medium">Back to Details</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * End of movie overlay.
 */
function MovieEndOverlay({
  title,
  onReplay,
  onBack,
}: {
  title?: string;
  onReplay?: () => void;
  onBack?: () => void;
}) {
  return (
    <View className="flex items-center justify-center p-6">
      <View className="bg-black/80 rounded-xl p-6 max-w-md">
        <View className="flex items-center mb-4">
          <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
        </View>
        <Text className="text-white text-xl font-semibold text-center mb-2">
          Finished
        </Text>
        {title && (
          <Text className="text-white/70 text-center mb-6">
            {title}
          </Text>
        )}
        <View className="flex flex-row gap-3 justify-center">
          {onReplay && (
            <Pressable
              onPress={onReplay}
              className="bg-indigo-600 px-6 py-3 rounded-lg hover:bg-indigo-500"
            >
              <Text className="text-white font-medium">Watch Again</Text>
            </Pressable>
          )}
          {onBack && (
            <Pressable
              onPress={onBack}
              className="bg-zinc-700 px-6 py-3 rounded-lg hover:bg-zinc-600"
            >
              <Text className="text-white font-medium">Back to Details</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Next episode countdown overlay.
 */
function NextEpisodeOverlay({
  nextEpisode,
  countdown,
  onPlay,
  onCancel,
}: {
  nextEpisode: NextEpisode;
  countdown: number;
  onPlay?: () => void;
  onCancel?: () => void;
}) {
  return (
    <View className="flex items-center justify-center p-6">
      <View className="bg-black/80 rounded-xl p-6 max-w-lg">
        <Text className="text-white/70 text-sm mb-2">Up Next</Text>
        <Text className="text-white text-xl font-semibold mb-4">
          S{nextEpisode.seasonNumber}E{nextEpisode.episodeNumber} "{nextEpisode.title}"
        </Text>

        {nextEpisode.thumbnailUrl && (
          <Image
            source={{ uri: nextEpisode.thumbnailUrl }}
            className="w-full h-32 rounded-lg mb-4"
            resizeMode="cover"
          />
        )}

        <Text className="text-white text-center mb-4">
          Playing in {countdown}...
        </Text>

        <View className="flex flex-row gap-3 justify-center">
          {onCancel && (
            <Pressable
              onPress={onCancel}
              className="bg-zinc-700 px-6 py-3 rounded-lg hover:bg-zinc-600"
            >
              <Text className="text-white font-medium">Cancel</Text>
            </Pressable>
          )}
          {onPlay && (
            <Pressable
              onPress={onPlay}
              className="bg-indigo-600 px-6 py-3 rounded-lg hover:bg-indigo-500"
            >
              <Text className="text-white font-medium">Play Now</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Network lost overlay.
 */
function NetworkLostOverlay({
  bufferRemaining,
}: {
  bufferRemaining?: number;
}) {
  return (
    <View className="flex items-center justify-center p-6">
      <View className="bg-black/80 rounded-xl p-6 max-w-md">
        <View className="flex items-center mb-4">
          <Ionicons name="cloud-offline" size={48} color="#f59e0b" />
        </View>
        <Text className="text-white text-xl font-semibold text-center mb-2">
          Connection Lost
        </Text>
        <Text className="text-white/70 text-center mb-4">
          Waiting for connection...
        </Text>
        {bufferRemaining !== undefined && bufferRemaining > 0 && (
          <Text className="text-white/70 text-center">
            Buffered: {formatBufferTime(bufferRemaining)}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Video player overlay component.
 */
export function PlayerOverlay({
  isLoading,
  isBuffering,
  hasEnded,
  error,
  isOffline,
  bufferRemaining,
  mediaType,
  title,
  nextEpisode,
  countdownDuration = 10,
  onRetry,
  onReplay,
  onNextEpisode,
  onCancelNextEpisode,
  onBack,
}: PlayerOverlayProps) {
  // Loading delay state (avoid flicker)
  const [showLoading, setShowLoading] = useState(false);
  const [showBuffering, setShowBuffering] = useState(false);

  // Next episode countdown
  const [countdown, setCountdown] = useState(countdownDuration);

  // Show loading after 1s delay
  useEffect(() => {
    if (!isLoading) {
      setShowLoading(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowLoading(true), 1000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Show buffering after 1s delay
  useEffect(() => {
    if (!isBuffering) {
      setShowBuffering(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowBuffering(true), 1000);
    return () => clearTimeout(timer);
  }, [isBuffering]);

  // Countdown for next episode
  useEffect(() => {
    if (!hasEnded || !nextEpisode || mediaType !== 'episode') {
      setCountdown(countdownDuration);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onNextEpisode?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [hasEnded, nextEpisode, mediaType, countdownDuration, onNextEpisode]);

  // Determine which overlay to show
  const showOverlay =
    showLoading ||
    showBuffering ||
    error ||
    hasEnded ||
    isOffline;

  if (!showOverlay) {
    return null;
  }

  return (
    <View
      className="absolute inset-0 flex items-center justify-center"
      style={{
        backgroundColor: error || hasEnded ? 'rgba(0,0,0,0.7)' : 'transparent',
      }}
    >
      {/* Network lost */}
      {isOffline && !error && (
        <NetworkLostOverlay bufferRemaining={bufferRemaining} />
      )}

      {/* Error */}
      {error && (
        <ErrorOverlay error={error} onRetry={onRetry} onBack={onBack} />
      )}

      {/* End of media */}
      {hasEnded && !error && (
        <>
          {mediaType === 'movie' || !nextEpisode ? (
            <MovieEndOverlay title={title} onReplay={onReplay} onBack={onBack} />
          ) : (
            <NextEpisodeOverlay
              nextEpisode={nextEpisode}
              countdown={countdown}
              onPlay={onNextEpisode}
              onCancel={onCancelNextEpisode}
            />
          )}
        </>
      )}

      {/* Loading */}
      {showLoading && !error && !hasEnded && !isOffline && <LoadingOverlay />}

      {/* Buffering */}
      {showBuffering && !showLoading && !error && !hasEnded && !isOffline && (
        <BufferingOverlay />
      )}
    </View>
  );
}

export default PlayerOverlay;
