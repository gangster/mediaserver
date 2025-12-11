/**
 * Login screen.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRANDING } from '@mediaserver/core';
import { useAuthStore } from '../src/stores/auth';
import { useLogin } from '@mediaserver/api-client';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { setAuth } = useAuthStore();
  const loginMutation = useLogin();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setError(null);

    try {
      const result = await loginMutation.mutateAsync({ email, password });
      await setAuth({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          {/* Logo/Title */}
          <View className="items-center mb-12">
            <Text className="text-4xl font-bold text-white mb-2">
              {BRANDING.name}
            </Text>
            <Text className="text-zinc-400 text-center">
              {BRANDING.tagline}
            </Text>
          </View>

          {/* Error message */}
          {error && (
            <View className="bg-error/20 border border-error rounded-lg p-3 mb-4">
              <Text className="text-error text-center">{error}</Text>
            </View>
          )}

          {/* Email input */}
          <View className="mb-4">
            <Text className="text-zinc-400 text-sm mb-2 font-medium">Email</Text>
            <TextInput
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white"
              placeholder="Enter your email"
              placeholderTextColor="#71717a"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          {/* Password input */}
          <View className="mb-6">
            <Text className="text-zinc-400 text-sm mb-2 font-medium">Password</Text>
            <TextInput
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white"
              placeholder="Enter your password"
              placeholderTextColor="#71717a"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
            />
          </View>

          {/* Login button */}
          <Pressable
            className="bg-primary rounded-lg py-4 items-center active:bg-primary-active disabled:opacity-50"
            onPress={handleLogin}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-lg">Sign In</Text>
            )}
          </Pressable>

          {/* Register link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-zinc-400">Don&apos;t have an account? </Text>
            <Link href="/register" asChild>
              <Pressable>
                <Text className="text-primary font-medium">Sign Up</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

