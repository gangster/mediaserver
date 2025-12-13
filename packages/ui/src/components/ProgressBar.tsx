/**
 * Progress bar component for watch progress and loading states.
 */

import { View, Text, type DimensionValue } from 'react-native';
import { cn } from '../utils/cn.js';

/** Progress bar variants */
export type ProgressVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';

/** Progress bar sizes */
export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';

/** Progress bar props */
export interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Progress variant */
  variant?: ProgressVariant;
  /** Progress size */
  size?: ProgressSize;
  /** Show percentage label */
  showLabel?: boolean;
  /** Label position */
  labelPosition?: 'left' | 'right' | 'inside';
  /** Custom class name for container */
  className?: string;
  /** Custom class name for track */
  trackClassName?: string;
  /** Custom class name for progress bar */
  barClassName?: string;
  /** Animated transitions */
  animated?: boolean;
  /** Indeterminate state */
  indeterminate?: boolean;
}

/** Variant colors */
const variantColors: Record<ProgressVariant, string> = {
  default: 'bg-zinc-500',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
};

/** Size heights */
const sizeHeights: Record<ProgressSize, { height: DimensionValue; text: string }> = {
  xs: { height: 2, text: 'text-xs' },
  sm: { height: 4, text: 'text-xs' },
  md: { height: 8, text: 'text-sm' },
  lg: { height: 12, text: 'text-base' },
};

/**
 * Progress bar component.
 *
 * @example
 * <ProgressBar value={75} variant="primary" showLabel />
 * <ProgressBar value={50} size="lg" />
 */
export function ProgressBar({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  showLabel = false,
  labelPosition = 'right',
  className,
  trackClassName,
  barClassName,
  animated = true,
  indeterminate = false,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const sizeStyle = sizeHeights[size];

  const renderLabel = () => {
    if (!showLabel) return null;

    return (
      <Text className={cn('font-medium text-zinc-400', sizeStyle.text)}>
        {Math.round(percentage)}%
      </Text>
    );
  };

  return (
    <View className={cn('flex-row items-center', className)}>
      {showLabel && labelPosition === 'left' && (
        <View className="mr-2">{renderLabel()}</View>
      )}

      <View
        className={cn('flex-1 bg-zinc-800 rounded-full overflow-hidden', trackClassName)}
        style={{ height: sizeStyle.height }}
      >
        <View
          className={cn(
            'h-full rounded-full',
            variantColors[variant],
            indeterminate && 'animate-pulse',
            barClassName
          )}
          style={{
            width: indeterminate ? '50%' : `${percentage}%`,
            ...(animated && !indeterminate && { transition: 'width 0.3s ease' }),
          }}
        />
      </View>

      {showLabel && labelPosition === 'right' && (
        <View className="ml-2">{renderLabel()}</View>
      )}
    </View>
  );
}

/**
 * Watch progress bar specifically for media items.
 * Shows progress as a thin bar at the bottom of posters/cards.
 */
export function WatchProgressBar({
  percentage,
  className,
}: {
  percentage: number;
  className?: string;
}) {
  if (percentage <= 0) return null;

  return (
    <View
      className={cn(
        'absolute bottom-0 left-0 right-0 h-1 bg-black/50',
        className
      )}
    >
      <View
        className="h-full bg-primary"
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </View>
  );
}

/**
 * Buffering indicator for video player.
 */
export function BufferProgress({
  buffered,
  played,
  className,
}: {
  buffered: number;
  played: number;
  className?: string;
}) {
  return (
    <View className={cn('h-1 bg-zinc-800 rounded-full overflow-hidden', className)}>
      {/* Buffered progress */}
      <View
        className="absolute h-full bg-zinc-600"
        style={{ width: `${buffered}%` }}
      />
      {/* Played progress */}
      <View
        className="absolute h-full bg-primary"
        style={{ width: `${played}%` }}
      />
    </View>
  );
}

export default ProgressBar;


