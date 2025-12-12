/**
 * Card component for containing content.
 */

import React from 'react';
import { View, Pressable, type ViewProps, type PressableProps } from 'react-native';
import { cn } from '../utils/cn.js';
import { isTV } from '../utils/platform.js';

/** Card variants */
export type CardVariant = 'default' | 'elevated' | 'outlined';

/** Card props */
export interface CardProps extends ViewProps {
  /** Card variant */
  variant?: CardVariant;
  /** Padding */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
  /** Children */
  children: React.ReactNode;
}

/** Pressable card props */
export interface PressableCardProps extends Omit<PressableProps, 'style'> {
  /** Card variant */
  variant?: CardVariant;
  /** Padding */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
  /** Children */
  children: React.ReactNode;
}

/** Variant classes */
const variantClasses: Record<CardVariant, string> = {
  default: 'bg-zinc-900',
  elevated: 'bg-zinc-800',
  outlined: 'bg-transparent border border-zinc-800',
};

/** Padding classes */
const paddingClasses: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

/**
 * Card component.
 *
 * @example
 * <Card variant="elevated" padding="md">
 *   <Text>Card content</Text>
 * </Card>
 */
export function Card({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <View
      className={cn(
        'rounded-xl overflow-hidden',
        variantClasses[variant],
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * Pressable card component.
 * Includes focus and press states.
 *
 * @example
 * <PressableCard onPress={handlePress}>
 *   <Text>Clickable card</Text>
 * </PressableCard>
 */
export function PressableCard({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: PressableCardProps) {
  const tv = isTV();

  return (
    <Pressable
      className={cn(
        'rounded-xl overflow-hidden',
        variantClasses[variant],
        paddingClasses[padding],
        tv && 'focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
        className
      )}
      {...props}
    >
      {({ pressed, focused }: { pressed: boolean; focused?: boolean }) => (
        <View
          className={cn(
            pressed && 'opacity-80',
            focused && tv && 'scale-105'
          )}
        >
          {children}
        </View>
      )}
    </Pressable>
  );
}

export default Card;

