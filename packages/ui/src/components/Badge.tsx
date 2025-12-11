/**
 * Badge component for status indicators.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '../utils/cn.js';

/** Badge variants */
export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'ai'
  | 'premium';

/** Badge sizes */
export type BadgeSize = 'sm' | 'md' | 'lg';

/** Badge props */
export interface BadgeProps {
  /** Badge content */
  children: React.ReactNode;
  /** Badge variant */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Custom class name */
  className?: string;
  /** Custom text class name */
  textClassName?: string;
  /** Show dot indicator */
  dot?: boolean;
  /** Dot color (overrides variant) */
  dotColor?: string;
}

/** Variant styles */
const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  default: {
    bg: 'bg-zinc-800',
    text: 'text-zinc-300',
    dot: 'bg-zinc-400',
  },
  primary: {
    bg: 'bg-primary/20',
    text: 'text-primary',
    dot: 'bg-primary',
  },
  secondary: {
    bg: 'bg-zinc-700',
    text: 'text-zinc-200',
    dot: 'bg-zinc-400',
  },
  success: {
    bg: 'bg-success/20',
    text: 'text-success',
    dot: 'bg-success',
  },
  warning: {
    bg: 'bg-warning/20',
    text: 'text-warning',
    dot: 'bg-warning',
  },
  error: {
    bg: 'bg-error/20',
    text: 'text-error',
    dot: 'bg-error',
  },
  info: {
    bg: 'bg-info/20',
    text: 'text-info',
    dot: 'bg-info',
  },
  ai: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    dot: 'bg-purple-500',
  },
  premium: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    dot: 'bg-yellow-500',
  },
};

/** Size styles */
const sizeStyles: Record<BadgeSize, { container: string; text: string; dot: string }> = {
  sm: {
    container: 'px-1.5 py-0.5 rounded',
    text: 'text-xs',
    dot: 'w-1 h-1 mr-1',
  },
  md: {
    container: 'px-2 py-1 rounded-md',
    text: 'text-sm',
    dot: 'w-1.5 h-1.5 mr-1.5',
  },
  lg: {
    container: 'px-3 py-1.5 rounded-lg',
    text: 'text-base',
    dot: 'w-2 h-2 mr-2',
  },
};

/**
 * Badge component.
 *
 * @example
 * <Badge variant="success">Watched</Badge>
 * <Badge variant="warning" dot>In Progress</Badge>
 */
export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
  textClassName,
  dot = false,
  dotColor,
}: BadgeProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <View
      className={cn(
        'flex-row items-center',
        variantStyle.bg,
        sizeStyle.container,
        className
      )}
    >
      {dot && (
        <View
          className={cn('rounded-full', sizeStyle.dot, variantStyle.dot)}
          style={dotColor ? { backgroundColor: dotColor } : undefined}
        />
      )}
      <Text className={cn('font-medium', variantStyle.text, sizeStyle.text, textClassName)}>
        {children}
      </Text>
    </View>
  );
}

/** Rating badge for different sources */
export function RatingBadge({
  source,
  rating,
  className,
}: {
  source: 'imdb' | 'rt' | 'metacritic' | 'tmdb';
  rating: number;
  className?: string;
}) {
  const sourceConfig = {
    imdb: { label: 'IMDb', color: '#f5c518', max: 10 },
    rt: { label: 'RT', color: '#fa320a', max: 100 },
    metacritic: { label: 'MC', color: '#ffcc33', max: 100 },
    tmdb: { label: 'TMDB', color: '#01d277', max: 10 },
  };

  const config = sourceConfig[source];
  const displayRating = config.max === 10 ? rating.toFixed(1) : Math.round(rating);

  return (
    <View
      className={cn('flex-row items-center px-2 py-1 rounded-md', className)}
      style={{ backgroundColor: `${config.color}20` }}
    >
      <Text className="text-xs font-bold mr-1" style={{ color: config.color }}>
        {config.label}
      </Text>
      <Text className="text-sm font-semibold text-white">{displayRating}</Text>
    </View>
  );
}

/** Watch status badge */
export function WatchStatusBadge({
  status,
  className,
}: {
  status: 'watched' | 'in-progress' | 'unwatched';
  className?: string;
}) {
  const statusConfig = {
    watched: { label: 'Watched', variant: 'success' as const },
    'in-progress': { label: 'In Progress', variant: 'warning' as const },
    unwatched: { label: 'Unwatched', variant: 'default' as const },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} size="sm" dot className={className}>
      {config.label}
    </Badge>
  );
}

export default Badge;

