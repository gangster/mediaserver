/**
 * Registration page
 *
 * Styled to match forreel project with emerald/teal theme.
 */

import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerFormSchema, type RegisterFormInput } from '@mediaserver/config';
import { useAuth } from '../../src/hooks/useAuth';

export default function Register() {
  const { register: registerUser, isLoading, error, clearError } = useAuth();
  const router = useRouter();
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      displayName: '',
    },
  });

  const onSubmit = async (data: RegisterFormInput) => {
    clearError();
    try {
      await registerUser(data.email, data.password, data.displayName, data.inviteCode);
      router.replace('/');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <View className="flex-1 flex-row bg-zinc-900">
      {/* Left side - branding (hidden on small screens) */}
      <View className="hidden lg:flex w-1/2 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-500 p-12 justify-between">
        <View>
          <Text className="text-4xl font-bold text-white">MediaServer</Text>
          <Text className="text-white/80 mt-2">Your media. Your server. Your privacy.</Text>
        </View>

        {/* Getting Started card */}
        <View className="bg-white/10 rounded-2xl p-6">
          <Text className="text-white font-medium text-lg mb-3">Getting Started</Text>
          <View className="gap-3">
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full bg-white/20 items-center justify-center">
                <Text className="text-white text-sm">1</Text>
              </View>
              <Text className="text-white/80">Create your admin account</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full bg-white/20 items-center justify-center">
                <Text className="text-white text-sm">2</Text>
              </View>
              <Text className="text-white/80">Add your media libraries</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full bg-white/20 items-center justify-center">
                <Text className="text-white text-sm">3</Text>
              </View>
              <Text className="text-white/80">Start streaming your content</Text>
            </View>
          </View>
        </View>

        <Text className="text-white/40 text-sm">© 2024 MediaServer. Apache 2.0 License.</Text>
      </View>

      {/* Right side - register form */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-1 items-center justify-center p-8"
      >
        <View className="w-full max-w-md">
          {/* Mobile branding */}
          <View className="lg:hidden mb-8">
            <Text className="text-3xl font-bold text-emerald-400">MediaServer</Text>
          </View>

          <Text className="text-2xl font-bold text-white mb-2">Create an account</Text>
          <Text className="text-zinc-400 mb-8">Set up your MediaServer</Text>

          {/* Error display */}
          {error && (
            <View className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <Text className="text-red-400 text-sm">{error}</Text>
              <Pressable onPress={clearError}>
                <Text className="text-red-400/60 text-xs mt-1">Dismiss</Text>
              </Pressable>
            </View>
          )}

          {/* Register form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              console.log('Register form submitted');
              handleSubmit(onSubmit)();
            }}
            className="flex flex-col gap-5"
          >
            {/* Display Name field */}
            <View>
              <Text className="text-sm font-medium text-zinc-300 mb-2">Display Name</Text>
              <Controller
                control={control}
                name="displayName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`w-full px-4 py-3 rounded-lg bg-zinc-800/50 text-white placeholder:text-zinc-500 border ${
                      errors.displayName
                        ? 'border-red-500/50'
                        : focusedField === 'displayName'
                          ? 'border-emerald-500'
                          : 'border-zinc-700'
                    }`}
                    placeholder="John Doe"
                    placeholderTextColor="#71717a"
                    autoComplete="name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      setFocusedField(null);
                    }}
                    onFocus={() => setFocusedField('displayName')}
                  />
                )}
              />
              {errors.displayName && (
                <Text className="text-red-400 text-xs mt-1">{errors.displayName.message}</Text>
              )}
            </View>

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
                          ? 'border-emerald-500'
                          : 'border-zinc-700'
                    }`}
                    placeholder="you@example.com"
                    placeholderTextColor="#71717a"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      setFocusedField(null);
                    }}
                    onFocus={() => setFocusedField('email')}
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
                    className={`w-full px-4 py-3 rounded-lg bg-zinc-800/50 text-white placeholder:text-zinc-500 border ${
                      errors.password
                        ? 'border-red-500/50'
                        : focusedField === 'password'
                          ? 'border-emerald-500'
                          : 'border-zinc-700'
                    }`}
                    placeholder="••••••••"
                    placeholderTextColor="#71717a"
                    secureTextEntry
                    autoComplete="new-password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      setFocusedField(null);
                    }}
                    onFocus={() => setFocusedField('password')}
                  />
                )}
              />
              <Text className="text-zinc-500 text-xs mt-1">At least 8 characters</Text>
              {errors.password && (
                <Text className="text-red-400 text-xs mt-1">{errors.password.message}</Text>
              )}
            </View>

            {/* Confirm Password field */}
            <View>
              <Text className="text-sm font-medium text-zinc-300 mb-2">Confirm Password</Text>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`w-full px-4 py-3 rounded-lg bg-zinc-800/50 text-white placeholder:text-zinc-500 border ${
                      errors.confirmPassword
                        ? 'border-red-500/50'
                        : focusedField === 'confirmPassword'
                          ? 'border-emerald-500'
                          : 'border-zinc-700'
                    }`}
                    placeholder="••••••••"
                    placeholderTextColor="#71717a"
                    secureTextEntry
                    autoComplete="new-password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      setFocusedField(null);
                    }}
                    onFocus={() => setFocusedField('confirmPassword')}
                  />
                )}
              />
              {errors.confirmPassword && (
                <Text className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</Text>
              )}
            </View>

            {/* Submit button */}
            <Pressable
              onPress={() => {
                console.log('Create account button pressed');
                handleSubmit(onSubmit)();
              }}
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg flex-row items-center justify-center gap-2 ${
                isLoading
                  ? 'bg-emerald-600/50'
                  : 'bg-emerald-600 active:bg-emerald-500'
              }`}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator size="small" color="white" />
                  <Text className="text-white font-medium">Creating account...</Text>
                </>
              ) : (
                <Text className="text-white font-medium">Create account</Text>
              )}
            </Pressable>
          </form>

          {/* Login link */}
          <View className="mt-8 flex-row justify-center">
            <Text className="text-zinc-400">Already have an account? </Text>
            <Link href="/auth/login" asChild>
              <Pressable>
                <Text className="text-emerald-400">Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
