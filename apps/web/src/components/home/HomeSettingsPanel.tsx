/**
 * HomeSettingsPanel component
 *
 * A slide-out panel that allows users to toggle visibility of
 * different sections on the Home page.
 */

import { useCallback, useEffect } from 'react';
import { View, Text, Pressable, Switch, Platform } from 'react-native';
import {
  usePreferencesStore,
  type HomePreferences,
  homeSectionNames,
} from '../../stores/preferences';

export interface HomeSettingsPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Called when the panel should close */
  onClose: () => void;
}

/**
 * Toggle switch component
 */
function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      className="flex flex-row items-center justify-between py-3"
    >
      <Text className="text-white">{label}</Text>
      <Switch
        value={checked}
        onValueChange={onChange}
        trackColor={{ false: '#3f3f46', true: '#059669' }}
        thumbColor="#ffffff"
      />
    </Pressable>
  );
}

/**
 * HomeSettingsPanel component
 */
export function HomeSettingsPanel({ isOpen, onClose }: HomeSettingsPanelProps) {
  const { homePreferences, setHomePreferences } = usePreferencesStore();

  // Handle escape key
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleToggle = useCallback(
    (key: keyof HomePreferences, value: boolean) => {
      setHomePreferences({ [key]: value });
    },
    [setHomePreferences]
  );

  const handleEnableAll = useCallback(() => {
    setHomePreferences({
      showHeroBanner: true,
      showContinueWatching: true,
      showRecentMovies: true,
      showRecentShows: true,
      showTopRated: true,
      showStats: true,
    });
  }, [setHomePreferences]);

  const handleDisableAll = useCallback(() => {
    setHomePreferences({
      showHeroBanner: false,
      showContinueWatching: false,
      showRecentMovies: false,
      showRecentShows: false,
      showTopRated: false,
      showStats: false,
    });
  }, [setHomePreferences]);

  // Section keys in display order
  const sectionKeys: (keyof HomePreferences)[] = [
    'showHeroBanner',
    'showStats',
    'showContinueWatching',
    'showRecentMovies',
    'showRecentShows',
    'showTopRated',
  ];

  if (!isOpen) return null;

  return (
    <View className="fixed inset-0 z-50">
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        className="absolute inset-0 bg-black/60"
      />

      {/* Panel */}
      <View className="absolute right-0 top-0 h-full w-80 max-w-full bg-zinc-900 border-l border-zinc-800 shadow-2xl">
        {/* Header */}
        <View className="flex flex-row items-center justify-between p-4 border-b border-zinc-800">
          <Text className="text-lg font-semibold text-white">
            Customize Home
          </Text>
          <Pressable
            onPress={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg"
          >
            <svg
              className="w-5 h-5 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Pressable>
        </View>

        {/* Content */}
        <View className="p-4 flex-1">
          <Text className="text-zinc-400 text-sm mb-4">
            Choose which sections to display on your home page.
          </Text>

          {/* Quick actions */}
          <View className="flex flex-row gap-2 mb-4">
            <Pressable
              onPress={handleEnableAll}
              className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg"
            >
              <Text className="text-white text-sm text-center">Enable All</Text>
            </Pressable>
            <Pressable
              onPress={handleDisableAll}
              className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg"
            >
              <Text className="text-white text-sm text-center">
                Disable All
              </Text>
            </Pressable>
          </View>

          {/* Section toggles */}
          <View className="border-t border-zinc-800">
            {sectionKeys.map((key) => (
              <View key={key} className="border-b border-zinc-800">
                <ToggleSwitch
                  label={homeSectionNames[key]}
                  checked={homePreferences[key]}
                  onChange={(checked) => handleToggle(key, checked)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View className="p-4 border-t border-zinc-800">
          <Pressable
            onPress={onClose}
            className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg"
          >
            <Text className="text-white font-medium text-center">Done</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * Settings button to open the panel
 */
export function HomeSettingsButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="p-2 rounded-lg active:bg-zinc-800"
      accessibilityLabel="Customize home page"
    >
      <svg
        className="w-5 h-5 text-zinc-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    </Pressable>
  );
}

export default HomeSettingsPanel;

