/**
 * Volume control component with mute toggle and slider.
 *
 * Features:
 * - Mute/unmute button
 * - Horizontal volume slider (shows on hover)
 * - Volume icon changes based on level
 */

import React, { useCallback, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Props for the VolumeControl component */
export interface VolumeControlProps {
  /** Current volume (0-1) */
  volume: number;
  /** Whether audio is muted */
  muted: boolean;
  /** Callback when volume changes */
  onVolumeChange: (volume: number) => void;
  /** Callback when mute state changes */
  onMutedChange: (muted: boolean) => void;
  /** Size of the control */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Get the appropriate volume icon based on level.
 */
function getVolumeIcon(volume: number, muted: boolean): keyof typeof Ionicons.glyphMap {
  if (muted || volume === 0) return 'volume-mute';
  if (volume < 0.33) return 'volume-low';
  if (volume < 0.66) return 'volume-medium';
  return 'volume-high';
}

/**
 * Volume control component.
 */
export function VolumeControl({
  volume,
  muted,
  onVolumeChange,
  onMutedChange,
  size = 'md',
}: VolumeControlProps) {
  const [showSlider, setShowSlider] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Size mappings
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 28 : 22;
  const sliderWidth = size === 'sm' ? 60 : size === 'lg' ? 100 : 80;
  const sliderHeight = size === 'sm' ? 3 : size === 'lg' ? 5 : 4;

  /**
   * Toggle mute state
   */
  const toggleMute = useCallback(() => {
    onMutedChange(!muted);
  }, [muted, onMutedChange]);

  /**
   * Handle slider click/drag
   */
  const handleSliderChange = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newVolume = Math.max(0, Math.min(1, x / rect.width));
      onVolumeChange(newVolume);

      // Unmute if volume is being set
      if (muted && newVolume > 0) {
        onMutedChange(false);
      }
    },
    [muted, onVolumeChange, onMutedChange]
  );

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsDragging(true);
      handleSliderChange(e);

      // Capture the target element immediately - e.currentTarget is nullified after the event
      const sliderElement = e.currentTarget;
      if (!sliderElement) return;

      const handleDrag = (moveEvent: MouseEvent) => {
        const rect = sliderElement.getBoundingClientRect();
        const x = moveEvent.clientX - rect.left;
        const newVolume = Math.max(0, Math.min(1, x / rect.width));
        onVolumeChange(newVolume);
      };

      const handleDragEnd = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
      };

      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
    },
    [handleSliderChange, onVolumeChange]
  );

  // Calculate fill width
  const fillWidth = muted ? 0 : volume * 100;

  return (
    <View
      className="flex flex-row items-center"
      // @ts-expect-error - Web-only event handlers
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => !isDragging && setShowSlider(false)}
    >
      {/* Mute button */}
      <Pressable
        onPress={toggleMute}
        className="p-1 hover:bg-white/10 rounded"
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute' : 'Mute'}
      >
        <Ionicons
          name={getVolumeIcon(volume, muted)}
          size={iconSize}
          color="white"
        />
      </Pressable>

      {/* Volume slider (shows on hover) */}
      {showSlider && (
        <View
          className="ml-2 flex flex-row items-center"
          style={{ width: sliderWidth }}
        >
          <View
            className="relative w-full rounded-full bg-white/20 cursor-pointer"
            style={{ height: sliderHeight }}
            // @ts-expect-error - Web-only event handlers
            onClick={handleSliderChange}
            onMouseDown={handleDragStart}
          >
            {/* Fill */}
            <View
              className="absolute h-full rounded-full bg-white"
              style={{ width: `${fillWidth}%` }}
            />

            {/* Handle */}
            <View
              className="absolute h-3 w-3 rounded-full bg-white shadow-lg"
              style={{
                left: `${fillWidth}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
              } as React.CSSProperties}
            />
          </View>

          {/* Volume percentage (optional) */}
          {size !== 'sm' && (
            <Text className="ml-2 text-xs text-white/70 w-8 text-right">
              {muted ? '0%' : `${Math.round(volume * 100)}%`}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export default VolumeControl;

