/**
 * Skeleton loading placeholder component.
 */

import { useEffect, useRef } from 'react';
import { View, Animated, type ViewStyle, type DimensionValue } from 'react-native';
import { cn } from '../utils/cn.js';

/** Skeleton props */
export interface SkeletonProps {
  /** Width of skeleton */
  width?: DimensionValue;
  /** Height of skeleton */
  height?: DimensionValue;
  /** Border radius */
  borderRadius?: number;
  /** Use rounded (full circle) */
  rounded?: boolean;
  /** Custom class name */
  className?: string;
  /** Disable animation */
  disableAnimation?: boolean;
}

/**
 * Skeleton component for loading placeholders.
 *
 * @example
 * <Skeleton width={200} height={20} />
 * <Skeleton width={100} height={100} rounded />
 */
export function Skeleton({
  width,
  height = 20,
  borderRadius = 8,
  rounded = false,
  className,
  disableAnimation = false,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (disableAnimation) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity, disableAnimation]);

  const style: ViewStyle = {
    width,
    height,
    borderRadius: rounded ? 9999 : borderRadius,
  };

  return (
    <Animated.View
      className={cn('bg-zinc-800', className)}
      style={[style, { opacity: disableAnimation ? 0.3 : opacity }]}
    />
  );
}

/** Skeleton for text content */
export function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <View className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={16}
        />
      ))}
    </View>
  );
}

/** Skeleton for media card */
export function SkeletonMediaCard({ className }: { className?: string }) {
  return (
    <View className={cn('w-32', className)}>
      <Skeleton width="100%" height={192} borderRadius={12} />
      <View className="mt-2">
        <Skeleton width="80%" height={14} />
        <Skeleton width="40%" height={12} className="mt-1" />
      </View>
    </View>
  );
}

/** Skeleton for avatar */
export function SkeletonAvatar({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return <Skeleton width={size} height={size} rounded className={className} />;
}

export default Skeleton;

