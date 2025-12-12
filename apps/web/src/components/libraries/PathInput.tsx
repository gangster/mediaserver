/**
 * PathInput - Reusable path input with real-time validation.
 *
 * Uses useCheckPath hook with debounced input for snappy validation.
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useCheckPath, useCreatePath } from '@mediaserver/api-client';
import { useDebounce } from '../../hooks';

const DEBOUNCE_MS = 300;

export type PathValidationStatus =
  | 'empty'
  | 'invalid-format'
  | 'duplicate'
  | 'checking'
  | 'valid'
  | 'not-writable'
  | 'can-create'
  | 'cannot-create'
  | 'not-directory';

export interface PathInputProps {
  /** Current path value */
  value: string;
  /** Called when path changes */
  onChange: (value: string) => void;
  /** Called when remove button is pressed */
  onRemove?: () => void;
  /** Whether remove button is shown */
  canRemove?: boolean;
  /** List of other paths (for duplicate detection) */
  otherPaths?: string[];
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

interface CheckPathResult {
  exists: boolean;
  isDirectory: boolean;
  isWritable: boolean;
  parentExists: boolean;
  parentWritable: boolean;
}

/**
 * Get validation status from checkPath result
 */
function getValidationStatus(
  path: string,
  isLoading: boolean,
  data: CheckPathResult | undefined,
  otherPaths: string[]
): PathValidationStatus {
  const trimmedPath = path.trim();

  // Empty
  if (!trimmedPath) {
    return 'empty';
  }

  // Invalid format (must start with /)
  if (!trimmedPath.startsWith('/')) {
    return 'invalid-format';
  }

  // Duplicate check
  if (otherPaths.includes(trimmedPath)) {
    return 'duplicate';
  }

  // Still loading
  if (isLoading) {
    return 'checking';
  }

  // No data yet
  if (!data) {
    return 'checking';
  }

  // Path exists
  if (data.exists) {
    if (!data.isDirectory) {
      return 'not-directory';
    }
    if (!data.isWritable) {
      return 'not-writable';
    }
    return 'valid';
  }

  // Path doesn't exist - check if we can create it
  if (data.parentExists && data.parentWritable) {
    return 'can-create';
  }

  return 'cannot-create';
}

/**
 * Status indicator component
 */
function StatusIndicator({ status }: { status: PathValidationStatus }) {
  switch (status) {
    case 'empty':
      return null;

    case 'checking':
      return <ActivityIndicator size="small" color="#71717a" />;

    case 'valid':
      return (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22c55e"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </View>
      );

    case 'not-writable':
      return (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: 'rgba(234, 179, 8, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#eab308"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </View>
      );

    case 'can-create':
      return (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </View>
      );

    case 'invalid-format':
    case 'duplicate':
    case 'cannot-create':
    case 'not-directory':
      return (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef4444"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </View>
      );

    default:
      return null;
  }
}

/**
 * Get status message
 */
function getStatusMessage(status: PathValidationStatus): string | null {
  switch (status) {
    case 'empty':
    case 'checking':
      return null;
    case 'invalid-format':
      return 'Path must start with /';
    case 'duplicate':
      return 'Path already added';
    case 'valid':
      return 'Directory exists and is writable';
    case 'not-writable':
      return 'Directory exists but is not writable';
    case 'can-create':
      return 'Directory does not exist';
    case 'cannot-create':
      return 'Directory does not exist and cannot be created';
    case 'not-directory':
      return 'Path is not a directory';
    default:
      return null;
  }
}

/**
 * Get status message color
 */
function getStatusColor(status: PathValidationStatus): string {
  switch (status) {
    case 'valid':
      return '#22c55e';
    case 'not-writable':
      return '#eab308';
    case 'can-create':
      return '#3b82f6';
    case 'invalid-format':
    case 'duplicate':
    case 'cannot-create':
    case 'not-directory':
      return '#ef4444';
    default:
      return '#71717a';
  }
}

/**
 * Get border color for input
 */
function getBorderColor(status: PathValidationStatus): string {
  switch (status) {
    case 'valid':
      return '#22c55e';
    case 'not-writable':
      return '#eab308';
    case 'can-create':
      return '#3b82f6';
    case 'invalid-format':
    case 'duplicate':
    case 'cannot-create':
    case 'not-directory':
      return '#ef4444';
    default:
      return 'rgba(63, 63, 70, 0.5)';
  }
}

/**
 * PathInput component
 */
export function PathInput({
  value,
  onChange,
  onRemove,
  canRemove = false,
  otherPaths = [],
  autoFocus = false,
  placeholder = '/path/to/media',
}: PathInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Debounce the path for API calls
  const debouncedPath = useDebounce(value, DEBOUNCE_MS);

  // Only call API if path is valid format
  const shouldCheckPath = debouncedPath.trim().startsWith('/');

  // Check path status
  const { data, isLoading, refetch } = useCheckPath(debouncedPath, shouldCheckPath);

  // Create path mutation
  const createPath = useCreatePath();

  // Get validation status
  const status = getValidationStatus(value, isLoading, data, otherPaths);
  const statusMessage = getStatusMessage(status);
  const statusColor = getStatusColor(status);
  const borderColor = getBorderColor(status);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [autoFocus]);

  // Handle create folder
  const handleCreateFolder = async () => {
    if (status !== 'can-create' || isCreating) return;

    setIsCreating(true);
    try {
      await createPath.mutateAsync({ path: value.trim() });
      // Refetch to update status
      await refetch();
    } catch (error) {
      console.error('Failed to create folder:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor="#71717a"
            style={{
              flex: 1,
              backgroundColor: 'rgba(39, 39, 42, 0.5)',
              borderWidth: 1,
              borderColor,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              paddingRight: 44, // Space for status indicator
              fontSize: 14,
              color: '#ffffff',
              fontFamily: 'monospace',
              // @ts-expect-error - outlineStyle works on web
              outlineStyle: 'none',
            }}
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="none"
          />
          <View
            style={{
              position: 'absolute',
              right: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <StatusIndicator status={status} />
          </View>
        </View>

        {canRemove && (
          <Pressable
            onPress={onRemove}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            }}
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </Pressable>
        )}
      </View>

      {/* Status message and create button */}
      {(statusMessage || status === 'can-create') && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
          }}
        >
          {statusMessage && (
            <Text style={{ fontSize: 12, color: statusColor }}>
              {statusMessage}
            </Text>
          )}
          {status === 'can-create' && (
            <Pressable
              onPress={handleCreateFolder}
              disabled={isCreating}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderRadius: 6,
                borderWidth: 1,
                borderColor: 'rgba(59, 130, 246, 0.3)',
              }}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  <path d="M12 11v6M9 14h6" />
                </svg>
              )}
              <Text style={{ fontSize: 12, color: '#3b82f6', fontWeight: '500' }}>
                {isCreating ? 'Creating...' : 'Create Folder'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export default PathInput;
