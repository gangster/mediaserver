/**
 * Watch Layout
 *
 * Minimal layout for full-screen video playback.
 * No navigation chrome, just a black background.
 */

import { Stack } from 'expo-router';

export default function WatchLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor: 'black',
        },
      }}
    />
  );
}
