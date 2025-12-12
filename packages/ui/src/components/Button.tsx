/**
 * Button component with multiple variants and sizes.
 */

import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
} from 'react-native';
import { cn } from '../utils/cn.js';
import { isTV } from '../utils/platform.js';

/** Button variants */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

/** Button sizes */
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Button props */
export interface ButtonProps extends Omit<PressableProps, 'style'> {
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Button label */
  children: React.ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Full width */
  fullWidth?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom text class name */
  textClassName?: string;
}

/** Variant styles */
const variantStyles: Record<ButtonVariant, { base: string; pressed: string; text: string }> = {
  primary: {
    base: 'bg-primary',
    pressed: 'bg-primary-hover',
    text: 'text-white',
  },
  secondary: {
    base: 'bg-zinc-800',
    pressed: 'bg-zinc-700',
    text: 'text-white',
  },
  ghost: {
    base: 'bg-transparent',
    pressed: 'bg-zinc-800',
    text: 'text-white',
  },
  danger: {
    base: 'bg-error',
    pressed: 'bg-red-600',
    text: 'text-white',
  },
  outline: {
    base: 'bg-transparent border border-zinc-700',
    pressed: 'bg-zinc-800 border-zinc-600',
    text: 'text-white',
  },
};

/** Size styles */
const sizeStyles: Record<ButtonSize, { container: string; text: string }> = {
  sm: {
    container: 'h-8 px-3 rounded-md',
    text: 'text-sm',
  },
  md: {
    container: 'h-10 px-4 rounded-lg',
    text: 'text-base',
  },
  lg: {
    container: 'h-12 px-6 rounded-lg',
    text: 'text-lg',
  },
};

/**
 * Button component.
 *
 * @example
 * <Button variant="primary" onPress={handlePress}>
 *   Click me
 * </Button>
 */
export function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className,
  textClassName,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const tv = isTV();

  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  // Adjust size for TV
  const adjustedSize = tv && size === 'md' ? sizeStyles.lg : sizeStyle;

  return (
    <Pressable
      disabled={isDisabled}
      className={cn(
        'flex-row items-center justify-center',
        adjustedSize.container,
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
        tv && 'focus:ring-2 focus:ring-primary',
        className
      )}
      style={({ pressed }) => ({
        backgroundColor: pressed ? undefined : undefined,
      })}
      {...props}
    >
      {({ pressed: _pressed }) => (
        <>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={variant === 'ghost' || variant === 'outline' ? '#fafafa' : '#ffffff'}
            />
          ) : (
            <>
              {leftIcon && <span className="mr-2">{leftIcon}</span>}
              <Text
                className={cn(
                  'font-semibold',
                  adjustedSize.text,
                  variantStyle.text,
                  textClassName
                )}
              >
                {children}
              </Text>
              {rightIcon && <span className="ml-2">{rightIcon}</span>}
            </>
          )}
        </>
      )}
    </Pressable>
  );
}

export default Button;

