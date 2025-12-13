/**
 * Auth layout
 *
 * Public routes for authentication (login, register).
 * Redirects to home if already authenticated.
 */

import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../src/hooks/useAuth';

export default function AuthLayout() {
  const { isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to home if already authenticated
    if (isInitialized && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isInitialized, router]);

  // If authenticated and initialized, show loading while redirecting
  if (isInitialized && isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // For public auth routes, don't block on initialization
  // Show the forms immediately - they're public anyway
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor: '#18181b',
        },
      }}
    />
  );
}

