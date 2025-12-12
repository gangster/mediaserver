/**
 * Library Picker Component
 *
 * Slide-up sheet modal for selecting library type (Movies/TV Shows).
 * Mobile-only navigation pattern.
 */

import { useEffect, useCallback } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';

/** Library option definition */
interface LibraryOption {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  description: string;
}

const libraryOptions: LibraryOption[] = [
  {
    id: 'movies',
    label: 'Movies',
    path: '/movies',
    description: 'Browse your movie collection',
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
        />
      </svg>
    ),
  },
  {
    id: 'shows',
    label: 'TV Shows',
    path: '/tv',
    description: 'Browse your TV series collection',
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  },
];

export interface LibraryPickerProps {
  /** Whether the picker is open */
  isOpen: boolean;
  /** Callback when picker should close */
  onClose: () => void;
}

/**
 * Library Picker Component
 */
export function LibraryPicker({ isOpen, onClose }: LibraryPickerProps) {
  const router = useRouter();

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const handleSelect = (option: LibraryOption) => {
    router.push(option.path as '/movies');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <View className="fixed inset-0 z-50">
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        className="absolute inset-0 bg-black/60 animate-fade-in"
      />

      {/* Sheet */}
      <View className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-2xl animate-slide-up safe-area-pb">
        {/* Handle */}
        <View className="flex items-center pt-3 pb-2">
          <View className="w-10 h-1 rounded-full bg-zinc-600" />
        </View>

        {/* Header */}
        <View className="px-6 pb-4">
          <Text className="text-xl font-bold text-white">Library</Text>
          <Text className="text-sm text-zinc-400">Choose what to browse</Text>
        </View>

        {/* Options */}
        <View className="px-4 pb-6 gap-2">
          {libraryOptions.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => handleSelect(option)}
              className="w-full flex flex-row items-center gap-4 p-4 rounded-xl bg-zinc-800/50 active:bg-zinc-700 touch-target"
            >
              <View className="w-12 h-12 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                <View className="text-indigo-400">{option.icon}</View>
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium">{option.label}</Text>
                <Text className="text-sm text-zinc-400">
                  {option.description}
                </Text>
              </View>
              <svg
                className="w-5 h-5 text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Pressable>
          ))}
        </View>

        {/* Cancel button */}
        <View className="px-4 pb-4">
          <Pressable
            onPress={onClose}
            className="w-full py-3 rounded-xl bg-zinc-800 active:bg-zinc-600 touch-target"
          >
            <Text className="text-zinc-300 text-center">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default LibraryPicker;
