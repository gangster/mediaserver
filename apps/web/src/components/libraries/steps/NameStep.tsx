/**
 * NameStep - Step 2 of the Add Library Wizard
 *
 * Allows users to name their library with smart defaults.
 */

import { useEffect, useRef } from 'react';
import { View, Text, TextInput } from 'react-native';

export interface NameStepProps {
  /** Current library name */
  name: string;
  /** Called when name changes */
  onChange: (name: string) => void;
  /** Called when Enter is pressed (if provided) */
  onSubmit?: () => void;
}

const MAX_NAME_LENGTH = 100;

/**
 * NameStep component
 */
export function NameStep({ name, onChange, onSubmit }: NameStepProps) {
  const inputRef = useRef<TextInput>(null);

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, []);

  const handleKeyPress = (e: { nativeEvent: { key: string } }) => {
    if (e.nativeEvent.key === 'Enter' && onSubmit) {
      onSubmit();
    }
  };

  const showError = name.length > MAX_NAME_LENGTH;

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 14, color: '#a1a1aa', textAlign: 'center', marginBottom: 8 }}>
        Give your library a name to identify it.
      </Text>

      <View style={{ gap: 8 }}>
        <TextInput
          ref={inputRef}
          value={name}
          onChangeText={onChange}
          onKeyPress={handleKeyPress}
          placeholder="Enter library name..."
          placeholderTextColor="#71717a"
          style={{
            backgroundColor: 'rgba(39, 39, 42, 0.5)',
            borderWidth: 1,
            borderColor: showError
              ? '#ef4444'
              : name.length > 0
                ? '#22c55e'
                : 'rgba(63, 63, 70, 0.5)',
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: '#ffffff',
            // @ts-expect-error - outlineStyle works on web
            outlineStyle: 'none',
          }}
          autoComplete="off"
          autoCorrect={false}
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
          }}
        >
          {showError ? (
            <Text style={{ fontSize: 12, color: '#ef4444' }}>
              Name must be {MAX_NAME_LENGTH} characters or less
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: '#71717a' }}>
              Choose a descriptive name for your library
            </Text>
          )}
          <Text
            style={{
              fontSize: 12,
              color: showError ? '#ef4444' : '#71717a',
            }}
          >
            {name.length}/{MAX_NAME_LENGTH}
          </Text>
        </View>
      </View>

      {/* Hint about smart defaults */}
      {name === 'Movies' || name === 'TV Shows' ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(34, 197, 94, 0.2)',
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22c55e"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <Text style={{ fontSize: 13, color: '#22c55e' }}>
            Using suggested name based on library type
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default NameStep;
