/**
 * SuccessStep - Step 4 of the Add Library Wizard
 *
 * Shows success state with options to scan now or close.
 */

import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import type { LibraryType } from '../AddLibraryWizard';

export interface SuccessStepProps {
  /** Name of the created library */
  libraryName: string;
  /** Type of the created library */
  libraryType: LibraryType;
  /** Called when Scan Now is pressed */
  onScanNow: () => void;
  /** Called when Done is pressed */
  onDone: () => void;
  /** Whether scan is in progress */
  isScanning: boolean;
}

/**
 * SuccessStep component
 */
export function SuccessStep({
  libraryName,
  libraryType,
  onScanNow,
  onDone,
  isScanning,
}: SuccessStepProps) {
  const typeLabel = libraryType === 'movie' ? 'Movies' : 'TV Shows';
  const typeColor = libraryType === 'movie' ? '#818cf8' : '#c084fc';

  return (
    <View style={{ alignItems: 'center', gap: 24, paddingVertical: 16 }}>
      {/* Success icon */}
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: 'rgba(34, 197, 94, 0.15)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={32}
            height={32}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22c55e"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </View>
      </View>

      {/* Success message */}
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 14, color: '#a1a1aa' }}>
          Your library is ready
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>
            {libraryName}
          </Text>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 12,
              backgroundColor:
                libraryType === 'movie'
                  ? 'rgba(99, 102, 241, 0.2)'
                  : 'rgba(168, 85, 247, 0.2)',
            }}
          >
            <Text style={{ fontSize: 12, color: typeColor }}>
              {typeLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <Text
        style={{
          fontSize: 14,
          color: '#71717a',
          textAlign: 'center',
          lineHeight: 20,
          maxWidth: 300,
        }}
      >
        Start scanning now to discover your media, or do it later from the
        library settings.
      </Text>

      {/* Action buttons */}
      <View style={{ width: '100%', gap: 12, paddingTop: 8 }}>
        <Pressable
          onPress={onScanNow}
          disabled={isScanning}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 10,
            backgroundColor: '#22c55e',
          }}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          )}
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#ffffff' }}>
            {isScanning ? 'Starting Scan...' : 'Scan Now'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onDone}
          disabled={isScanning}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 10,
            backgroundColor: 'rgba(63, 63, 70, 0.5)',
            borderWidth: 1,
            borderColor: 'rgba(63, 63, 70, 0.5)',
            opacity: isScanning ? 0.5 : 1,
          }}
        >
          <Text style={{ fontSize: 15, color: '#a1a1aa' }}>
            Done
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default SuccessStep;

