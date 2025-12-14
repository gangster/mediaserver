/**
 * Video player progress bar with buffered indicator and thumbnail preview.
 *
 * Features:
 * - Current position indicator
 * - Buffered ranges display
 * - Hover to show time preview
 * - Thumbnail preview on hover (when trickplay data available)
 * - Click/drag to seek
 */

import React, { useCallback, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import type { BufferedRange } from '@mediaserver/api-client';

/** Props for thumbnail preview data */
export interface TrickplayData {
  spriteUrl: string;
  interval: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  columns: number;
  rows: number;
  totalThumbnails: number;
}

/** Props for the ProgressBar component */
export interface ProgressBarProps {
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Buffered time ranges */
  bufferedRanges: BufferedRange[];
  /** Trickplay data for thumbnail preview */
  trickplay?: TrickplayData | null;
  /** Whether seeking is in progress */
  seeking?: boolean;
  /** Intro segment to highlight */
  intro?: { start: number; end: number };
  /** Credits segment to highlight */
  credits?: { start: number; end: number };
  /** Callback when user seeks */
  onSeek: (time: number) => void;
  /** Callback when seeking starts */
  onSeekStart?: () => void;
  /** Callback when seeking ends */
  onSeekEnd?: () => void;
}

/**
 * Format seconds to MM:SS or HH:MM:SS string.
 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Get thumbnail position in sprite sheet for a given time.
 */
function getThumbnailPosition(
  time: number,
  trickplay: TrickplayData
): { x: number; y: number } | null {
  const thumbnailIndex = Math.floor(time / trickplay.interval);

  if (thumbnailIndex >= trickplay.totalThumbnails) {
    return null;
  }

  const row = Math.floor(thumbnailIndex / trickplay.columns);
  const col = thumbnailIndex % trickplay.columns;

  return {
    x: col * trickplay.thumbnailWidth,
    y: row * trickplay.thumbnailHeight,
  };
}

/**
 * Video player progress bar component.
 */
export function ProgressBar({
  currentTime,
  duration,
  bufferedRanges,
  trickplay,
  intro,
  credits,
  onSeek,
  onSeekStart,
  onSeekEnd,
}: ProgressBarProps) {
  const containerRef = useRef<View>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Calculate hover time
  const hoverTime = hoverPosition !== null && containerWidth > 0
    ? (hoverPosition / containerWidth) * duration
    : null;

  /**
   * Get time from mouse/touch position
   */
  const getTimeFromPosition = useCallback(
    (clientX: number): number => {
      if (!containerRef.current || containerWidth === 0) return 0;

      // Get container bounds - need to access the native element
      const element = containerRef.current as unknown as HTMLElement;
      if (!element.getBoundingClientRect) return 0;

      const rect = element.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / containerWidth));
      return percentage * duration;
    },
    [containerWidth, duration]
  );

  /**
   * Handle mouse/touch move for hover preview
   */
  const handleHover = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;

      const element = containerRef.current as unknown as HTMLElement;
      if (!element.getBoundingClientRect) return;

      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setHoverPosition(x);
    },
    []
  );

  /**
   * Handle seek on click
   */
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const time = getTimeFromPosition(e.clientX);
      onSeek(time);
    },
    [getTimeFromPosition, onSeek]
  );

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    onSeekStart?.();

    const handleDrag = (moveEvent: MouseEvent) => {
      const time = getTimeFromPosition(moveEvent.clientX);
      onSeek(time);
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      onSeekEnd?.();
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
    };

    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
  }, [getTimeFromPosition, onSeek, onSeekStart, onSeekEnd]);

  // Calculate intro/credits highlight positions
  const introLeft = intro ? (intro.start / duration) * 100 : 0;
  const introWidth = intro ? ((intro.end - intro.start) / duration) * 100 : 0;
  const creditsLeft = credits ? (credits.start / duration) * 100 : 0;
  const creditsWidth = credits ? ((credits.end - credits.start) / duration) * 100 : 0;

  // Get thumbnail position for hover preview
  const thumbnailPos = hoverTime !== null && trickplay
    ? getThumbnailPosition(hoverTime, trickplay)
    : null;

  return (
    <View className="relative w-full" style={{ height: 24 }}>
      {/* Hover preview (thumbnail + time) */}
      {hoverTime !== null && !isDragging && (
        <View
          className="absolute bottom-full mb-2 flex items-center justify-center"
          style={{
            left: hoverPosition ?? 0,
            transform: [{ translateX: -80 }],
          }}
        >
          {/* Thumbnail preview */}
          {thumbnailPos && trickplay && (
            <View
              className="mb-1 overflow-hidden rounded bg-black"
              style={{
                width: trickplay.thumbnailWidth,
                height: trickplay.thumbnailHeight,
              }}
            >
              <View
                style={{
                  width: trickplay.thumbnailWidth * trickplay.columns,
                  height: trickplay.thumbnailHeight * Math.ceil(trickplay.totalThumbnails / trickplay.columns),
                  backgroundImage: `url(${trickplay.spriteUrl})`,
                  backgroundPosition: `-${thumbnailPos.x}px -${thumbnailPos.y}px`,
                } as React.CSSProperties}
              />
            </View>
          )}

          {/* Time label */}
          <View className="rounded bg-black/80 px-2 py-1">
            <Text className="text-xs text-white font-medium">
              {formatTime(hoverTime)}
            </Text>
          </View>
        </View>
      )}

      {/* Progress bar track */}
      <View
        ref={containerRef}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        className="relative h-1 w-full cursor-pointer rounded bg-white/20"
        style={{ marginTop: 10 }}
      >
        {/* Buffered ranges */}
        {bufferedRanges.map((range, index) => (
          <View
            key={index}
            className="absolute h-full rounded bg-white/40"
            style={{
              left: `${(range.start / duration) * 100}%`,
              width: `${((range.end - range.start) / duration) * 100}%`,
            }}
          />
        ))}

        {/* Intro segment highlight */}
        {intro && (
          <View
            className="absolute h-full bg-yellow-500/30"
            style={{
              left: `${introLeft}%`,
              width: `${introWidth}%`,
            }}
          />
        )}

        {/* Credits segment highlight */}
        {credits && (
          <View
            className="absolute h-full bg-blue-500/30"
            style={{
              left: `${creditsLeft}%`,
              width: `${creditsWidth}%`,
            }}
          />
        )}

        {/* Progress fill */}
        <View
          className="absolute h-full rounded bg-indigo-500"
          style={{ width: `${progress}%` }}
        />

        {/* Progress handle */}
        <View
          className="absolute h-3 w-3 rounded-full bg-white shadow-lg"
          style={{
            left: `${progress}%`,
            top: -4,
            transform: [{ translateX: -6 }],
          }}
        />

        {/* Hover area (invisible, handles all interactions) */}
        <View
          className="absolute -top-3 left-0 right-0 h-6 cursor-pointer"
          // @ts-expect-error - Web-only event handlers
          onMouseMove={handleHover}
          onMouseLeave={() => setHoverPosition(null)}
          onClick={handleClick}
          onMouseDown={handleDragStart}
        />
      </View>

      {/* Time labels */}
      <View className="mt-1 flex flex-row justify-between">
        <Text className="text-xs text-white/70">{formatTime(currentTime)}</Text>
        <Text className="text-xs text-white/70">{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

export default ProgressBar;

