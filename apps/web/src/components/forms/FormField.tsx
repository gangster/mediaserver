/**
 * Reusable form field component with error display
 *
 * Adapted for React Native Web with NativeWind styling.
 */

import { forwardRef } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import type { FieldError } from 'react-hook-form';

interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  /** Field label */
  label: string;
  /** Optional helper text below the label */
  hint?: string;
  /** Field error from React Hook Form */
  error?: FieldError;
  /** Whether the field is optional (shows "(optional)" badge) */
  optional?: boolean;
  /** Custom color theme for focus ring */
  theme?: 'indigo' | 'emerald';
}

/**
 * Form field with label, input, and error message
 */
export const FormField = forwardRef<TextInput, FormFieldProps>(
  (
    {
      label,
      hint,
      error,
      optional,
      theme = 'indigo',
      ...inputProps
    },
    ref
  ) => {
    const focusColor = theme === 'emerald' ? '#10b981' : '#6366f1';
    const errorColor = '#ef4444';

    return (
      <View className="mb-4">
        <Text className="text-sm font-medium text-zinc-300 mb-2">
          {label}
          {optional && <Text className="text-zinc-500 ml-1"> (optional)</Text>}
        </Text>

        <TextInput
          ref={ref}
          className={`w-full px-4 py-3 rounded-lg bg-zinc-800/50 text-white placeholder:text-zinc-500 ${
            error
              ? 'border-2 border-red-500/50'
              : 'border border-zinc-700'
          }`}
          placeholderTextColor="#71717a"
          selectionColor={error ? errorColor : focusColor}
          {...inputProps}
        />

        {hint && !error && (
          <Text className="text-zinc-500 text-xs mt-1">{hint}</Text>
        )}

        {error && (
          <Text className="text-red-400 text-xs mt-1">{error.message}</Text>
        )}
      </View>
    );
  }
);

FormField.displayName = 'FormField';
