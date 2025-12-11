/**
 * Text component with typography presets.
 */

import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '../utils/cn.js';
import { isTV } from '../utils/platform.js';

/** Text variants */
export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'body'
  | 'bodyLarge'
  | 'bodySmall'
  | 'label'
  | 'labelSmall'
  | 'caption';

/** Text colors */
export type TextColor = 'primary' | 'secondary' | 'muted' | 'error' | 'success' | 'ai' | 'inherit';

/** Text props */
export interface TextProps extends RNTextProps {
  /** Typography variant */
  variant?: TextVariant;
  /** Text color */
  color?: TextColor;
  /** Bold text */
  bold?: boolean;
  /** Semibold text */
  semibold?: boolean;
  /** Italic text */
  italic?: boolean;
  /** Center alignment */
  center?: boolean;
  /** Number of lines (truncation) */
  numberOfLines?: number;
  /** Custom class name */
  className?: string;
  /** Children */
  children: React.ReactNode;
}

/** Variant to class mapping */
const variantClasses: Record<TextVariant, string> = {
  h1: 'text-5xl font-bold tracking-tight',
  h2: 'text-4xl font-bold tracking-tight',
  h3: 'text-3xl font-semibold',
  h4: 'text-2xl font-semibold',
  h5: 'text-xl font-medium',
  h6: 'text-lg font-medium',
  body: 'text-base',
  bodyLarge: 'text-lg',
  bodySmall: 'text-sm',
  label: 'text-sm font-medium tracking-wide',
  labelSmall: 'text-xs font-medium tracking-wide',
  caption: 'text-xs',
};

/** TV variant classes (1.5x scale) */
const tvVariantClasses: Record<TextVariant, string> = {
  h1: 'text-6xl font-bold tracking-tight',
  h2: 'text-5xl font-bold tracking-tight',
  h3: 'text-4xl font-semibold',
  h4: 'text-3xl font-semibold',
  h5: 'text-2xl font-medium',
  h6: 'text-xl font-medium',
  body: 'text-xl',
  bodyLarge: 'text-2xl',
  bodySmall: 'text-lg',
  label: 'text-lg font-medium tracking-wide',
  labelSmall: 'text-base font-medium tracking-wide',
  caption: 'text-base',
};

/** Color to class mapping */
const colorClasses: Record<TextColor, string> = {
  primary: 'text-white',
  secondary: 'text-zinc-400',
  muted: 'text-zinc-500',
  error: 'text-red-500',
  success: 'text-green-500',
  ai: 'text-purple-400',
  inherit: '',
};

/**
 * Text component with typography presets.
 *
 * @example
 * <Text variant="h1">Heading</Text>
 * <Text variant="body" color="secondary">Body text</Text>
 */
export function Text({
  variant = 'body',
  color = 'primary',
  bold = false,
  semibold = false,
  italic = false,
  center = false,
  numberOfLines,
  className,
  children,
  ...props
}: TextProps) {
  const tv = isTV();

  const variantClass = tv ? tvVariantClasses[variant] : variantClasses[variant];
  const colorClass = colorClasses[color];

  return (
    <RNText
      numberOfLines={numberOfLines}
      className={cn(
        variantClass,
        colorClass,
        bold && 'font-bold',
        semibold && 'font-semibold',
        italic && 'italic',
        center && 'text-center',
        className
      )}
      {...props}
    >
      {children}
    </RNText>
  );
}

export default Text;

