/**
 * Root layout for the app.
 *
 * Sets up providers and global configuration.
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ApiProvider } from '@mediaserver/api-client';
import { useAuthStore } from '../src/stores/auth';

import '../global.css';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { token, initialize, isInitialized } = useAuthStore();

  // Initialize auth state on mount
  useEffect(() => {
    initialize().finally(() => {
      SplashScreen.hideAsync();
    });
  }, [initialize]);

  // Don't render until initialized
  if (!isInitialized) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ApiProvider
        config={{
          baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
          getToken: () => token,
          debug: __DEV__,
        }}
      >
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0a0a0f' },
            animation: 'fade',
          }}
        />
      </ApiProvider>
    </GestureHandlerRootView>
  );
}

