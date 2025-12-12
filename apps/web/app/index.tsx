/**
 * Web App Home Screen
 *
 * The main landing screen for the web application.
 * Redirects to login if not authenticated.
 */

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { BRANDING } from '@mediaserver/core';
import { useAuth } from '../src/hooks/useAuth';

export default function WebHomeScreen() {
  const { isAuthenticated, isInitialized, user, logout } = useAuth();
  const [hasCheckedTokens, setHasCheckedTokens] = useState(false);
  const [hasTokens, setHasTokens] = useState(false);

  // Check for stored tokens on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedAuth = localStorage.getItem('mediaserver-auth');
        const tokens = storedAuth ? JSON.parse(storedAuth)?.state?.tokens?.accessToken : null;
        setHasTokens(!!tokens);
      } catch {
        setHasTokens(false);
      }
      setHasCheckedTokens(true);
    }
  }, []);

  // Wait for client-side token check
  if (!hasCheckedTokens) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    );
  }

  // Redirect to login if no tokens
  if (!hasTokens) {
    return <Redirect href="/auth/login" />;
  }

  // If tokens exist but user is not authenticated after init, redirect
  if (isInitialized && !isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  // Show loading while validating tokens
  if (!isInitialized) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="text-zinc-500 mt-4">Validating session...</Text>
      </SafeAreaView>
    );
  }

  // Authenticated - show main content
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
          Welcome back, {user?.displayName || 'User'}!
        </Text>
        <Text className="text-sm text-zinc-600 mt-2">
          Your media server is ready.
        </Text>

        {/* Logout button */}
        <Pressable
          onPress={logout}
          className="mt-8 px-6 py-3 rounded-lg bg-zinc-800 active:bg-zinc-700"
        >
          <Text className="text-zinc-300">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
