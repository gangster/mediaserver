/**
 * TV App Root Layout
 *
 * Sets up providers and navigation for the TV application.
 * Includes TV-specific focus management and remote control handling.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ApiProvider } from '@mediaserver/api-client';

import '../global.css';

export default function RootLayout() {
  return (
    <ApiProvider config={{ baseUrl: 'http://localhost:3000' }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: {
            backgroundColor: '#09090b',
          },
        }}
      />
    </ApiProvider>
  );
}

