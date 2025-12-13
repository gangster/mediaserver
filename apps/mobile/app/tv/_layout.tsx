/**
 * TV shows route layout.
 */

import { Stack } from 'expo-router';

export default function TVLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0f' },
        animation: 'slide_from_right',
      }}
    />
  );
}


