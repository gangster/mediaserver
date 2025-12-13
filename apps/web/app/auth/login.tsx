/**
 * Login page
 *
 * Styled to match forreel project with split layout and branding.
 */

import { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Link, useRouter, Redirect } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginFormSchema, type LoginFormInput } from '@mediaserver/config';
import { useSetupStatus } from '@mediaserver/api-client';
import { useAuth } from '../../src/hooks/useAuth';

export default function Login() {
  const { login, isLoading, error, clearError } = useAuth();
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus();
  const router = useRouter();
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Show loading while checking setup status
  if (setupLoading) {
    return (
      <View className="flex-1 bg-zinc-900 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Redirect to setup if not complete
  if (setupStatus && !setupStatus.isComplete) {
    return <Redirect href="/setup" />;
  }

  const onSubmit = async (data: LoginFormInput) => {
    clearError();
    try {
      await login(data.email, data.password);
      router.replace('/');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <View className="flex-1 flex-row bg-zinc-900">
      {/* Left side - branding (hidden on small screens) */}
      <View className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-12 justify-between">
        <View>
          <Text className="text-4xl font-bold text-white">MediaServer</Text>
          <Text className="text-white/80 mt-2">Your media. Your server. Your privacy.</Text>
        </View>

        <View className="gap-6">
          {/* Feature: Privacy First */}
          <View className="flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-xl bg-white/10 items-center justify-center">
              <Text className="text-2xl">🔒</Text>
            </View>
            <View>
              <Text className="text-white font-medium">Privacy First</Text>
              <Text className="text-white/60 text-sm">No tracking. No telemetry. Your data stays yours.</Text>
            </View>
          </View>

          {/* Feature: 4K Streaming */}
          <View className="flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-xl bg-white/10 items-center justify-center">
              <Text className="text-2xl">📺</Text>
            </View>
            <View>
              <Text className="text-white font-medium">4K Streaming</Text>
              <Text className="text-white/60 text-sm">HEVC, HDR, and adaptive bitrate.</Text>
            </View>
          </View>

          {/* Feature: Self-Hosted */}
          <View className="flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-xl bg-white/10 items-center justify-center">
              <Text className="text-2xl">☁️</Text>
            </View>
            <View>
              <Text className="text-white font-medium">Self-Hosted</Text>
              <Text className="text-white/60 text-sm">Run on your own hardware. No subscriptions.</Text>
            </View>
          </View>
        </View>

        <Text className="text-white/40 text-sm">© 2024 MediaServer. Apache 2.0 License.</Text>
      </View>

      {/* Right side - login form */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-1 items-center justify-center p-8"
      >
        <View className="w-full max-w-md">
          {/* Mobile branding */}
          <View className="lg:hidden mb-8">
            <Text className="text-3xl font-bold text-indigo-400">MediaServer</Text>
          </View>

          <Text className="text-2xl font-bold text-white mb-2">Welcome back</Text>
          <Text className="text-zinc-400 mb-8">Sign in to continue to your media library</Text>

          {/* Error display */}
          {error && (
            <View className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <Text className="text-red-400 text-sm">{error}</Text>
              <Pressable onPress={clearError}>
                <Text className="text-red-400/60 text-xs mt-1">Dismiss</Text>
              </Pressable>
            </View>
          )}

          {/* Login form */}
          <View className="gap-6">
            {/* Email field */}
            <View>
              <Text className="text-sm font-medium text-zinc-300 mb-2">Email</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`w-full px-4 py-3 rounded-lg bg-zinc-800/50 text-white placeholder:text-zinc-500 border ${
                      errors.email
                        ? 'border-red-500/50'
                        : focusedField === 'email'
                          ? 'border-indigo-500'
                          : 'border-zinc-700'
                    }`}
                    placeholder="you@example.com"
                    placeholderTextColor="#71717a"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    returnKeyType="next"
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      setFocusedField(null);
                    }}
                    onFocus={() => setFocusedField('email')}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                )}
              />
              {errors.email && (
                <Text className="text-red-400 text-xs mt-1">{errors.email.message}</Text>
              )}
            </View>

            {/* Password field */}
            <View>
              <Text className="text-sm font-medium text-zinc-300 mb-2">Password</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    ref={passwordInputRef}
                    className={`w-full px-4 py-3 rounded-lg bg-zinc-800/50 text-white placeholder:text-zinc-500 border ${
                      errors.password
                        ? 'border-red-500/50'
                        : focusedField === 'password'
                          ? 'border-indigo-500'
                          : 'border-zinc-700'
                    }`}
                    placeholder="••••••••"
                    placeholderTextColor="#71717a"
                    secureTextEntry
                    autoComplete="current-password"
                    returnKeyType="go"
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      setFocusedField(null);
                    }}
                    onFocus={() => setFocusedField('password')}
                    onSubmitEditing={handleSubmit(onSubmit)}
                  />
                )}
              />
              {errors.password && (
                <Text className="text-red-400 text-xs mt-1">{errors.password.message}</Text>
              )}
            </View>

            {/* Submit button */}
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              className="w-full py-3 px-4 rounded-lg bg-indigo-600 active:bg-indigo-500 flex-row items-center justify-center"
              style={{ opacity: isLoading ? 0.5 : 1 }}
            >
              <Text className="text-white font-medium">
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Text>
            </Pressable>
          </View>

          {/* Register link */}
          <View className="mt-8 flex-row justify-center">
            <Text className="text-zinc-400">Don&apos;t have an account? </Text>
            <Link href="/auth/register" asChild>
              <Pressable>
                <Text className="text-indigo-400">Create one</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

