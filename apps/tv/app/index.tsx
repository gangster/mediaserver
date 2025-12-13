/**
 * TV App Home Screen
 *
 * The main landing screen for TV devices (Android TV, Apple TV, Fire TV).
 * Optimized for remote control navigation with large touch targets and focus states.
 */

import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRANDING } from '@mediaserver/core';

export default function TVHomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-4xl font-bold text-white mb-4">
          {BRANDING.name}
        </Text>
        <Text className="text-xl text-zinc-400 text-center">
          {BRANDING.tagline}
        </Text>
        <Text className="text-lg text-zinc-500 mt-8 text-center">
          TV App Coming Soon
        </Text>
      </View>
    </SafeAreaView>
  );
}


