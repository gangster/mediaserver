/**
 * Input component with variants and states.
 */

import React, { forwardRef, useState } from 'react';
import {
  TextInput,
  View,
  Text,
  type TextInputProps,
} from 'react-native';
import { cn } from '../utils/cn.js';
import { isTV } from '../utils/platform.js';

/** Input variants */
export type InputVariant = 'default' | 'filled' | 'outline';

/** Input sizes */
export type InputSize = 'sm' | 'md' | 'lg';

/** Input props */
export interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Input variant */
  variant?: InputVariant;
  /** Input size */
  size?: InputSize;
  /** Label text */
  label?: string;
  /** Helper text below input */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Left icon/element */
  leftElement?: React.ReactNode;
  /** Right icon/element */
  rightElement?: React.ReactNode;
  /** Custom container class name */
  containerClassName?: string;
  /** Custom input class name */
  className?: string;
  /** Full width */
  fullWidth?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

/** Size styles */
const sizeStyles: Record<InputSize, { container: string; input: string; label: string }> = {
  sm: {
    container: 'h-9',
    input: 'text-sm px-3',
    label: 'text-xs mb-1',
  },
  md: {
    container: 'h-11',
    input: 'text-base px-4',
    label: 'text-sm mb-2',
  },
  lg: {
    container: 'h-14',
    input: 'text-lg px-4',
    label: 'text-base mb-2',
  },
};

/** Variant styles */
const variantStyles: Record<InputVariant, { base: string; focus: string }> = {
  default: {
    base: 'bg-zinc-900 border border-zinc-800',
    focus: 'border-primary',
  },
  filled: {
    base: 'bg-zinc-800 border-0',
    focus: 'ring-2 ring-primary',
  },
  outline: {
    base: 'bg-transparent border border-zinc-700',
    focus: 'border-primary',
  },
};

/**
 * Input component.
 *
 * @example
 * <Input
 *   label="Email"
 *   placeholder="Enter your email"
 *   keyboardType="email-address"
 * />
 */
export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      variant = 'default',
      size = 'md',
      label,
      helperText,
      error,
      leftElement,
      rightElement,
      containerClassName,
      className,
      fullWidth = false,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const tv = isTV();

    const sizeStyle = sizeStyles[size];
    const variantStyle = variantStyles[variant];

    // Adjust size for TV
    const adjustedSizeStyle = tv && size === 'md' ? sizeStyles.lg : sizeStyle;

    const hasError = Boolean(error);

    return (
      <View className={cn(fullWidth && 'w-full', containerClassName)}>
        {label && (
          <Text
            className={cn(
              'font-medium text-zinc-400',
              adjustedSizeStyle.label,
              hasError && 'text-error'
            )}
          >
            {label}
          </Text>
        )}

        <View
          className={cn(
            'flex-row items-center rounded-lg overflow-hidden',
            adjustedSizeStyle.container,
            variantStyle.base,
            isFocused && variantStyle.focus,
            hasError && 'border-error',
            disabled && 'opacity-50',
            tv && 'focus-within:ring-2 focus-within:ring-primary'
          )}
        >
          {leftElement && (
            <View className="pl-3 pr-1">{leftElement}</View>
          )}

          <TextInput
            ref={ref}
            className={cn(
              'flex-1 text-white',
              adjustedSizeStyle.input,
              leftElement && 'pl-2',
              rightElement && 'pr-2',
              className
            )}
            placeholderTextColor="#71717a"
            editable={!disabled}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />

          {rightElement && (
            <View className="pr-3 pl-1">{rightElement}</View>
          )}
        </View>

        {(helperText || error) && (
          <Text
            className={cn(
              'text-xs mt-1',
              hasError ? 'text-error' : 'text-zinc-500'
            )}
          >
            {error || helperText}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

export default Input;


