/**
 * Web App Home Screen
 *
 * The main landing screen for the web application.
 * Redirects to setup wizard if server is not configured.
 */

import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BRANDING } from '@mediaserver/core';
import { useSetupStatus } from '@mediaserver/api-client';

export default function WebHomeScreen() {
  const { data: setupStatus, isLoading, error } = useSetupStatus();

  // Redirect to setup if not complete
  useEffect(() => {
    if (setupStatus && !setupStatus.isComplete) {
      router.replace('/setup');
    }
  }, [setupStatus]);

  // Show loading while checking setup status
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="text-zinc-500 mt-4">Loading...</Text>
      </SafeAreaView>
    );
  }

  // Show error if API is not reachable
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-4xl mb-4">⚠️</Text>
        <Text className="text-xl font-bold text-white mb-2">
          Cannot Connect to Server
        </Text>
        <Text className="text-zinc-400 text-center mb-6">
          Make sure the mediaserver backend is running on port 3000.
        </Text>
        <View className="bg-zinc-900 rounded-lg p-4 max-w-sm">
          <Text className="text-zinc-500 font-mono text-sm">
            cd apps/server && bun run dev
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // If setup is complete, show main content
  // TODO: Replace with actual home screen content
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
          Welcome back! Your media server is ready.
        </Text>
      </View>
    </SafeAreaView>
  );
}
