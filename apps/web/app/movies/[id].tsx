/**
 * Movie Detail Page
 *
 * Displays detailed information about a specific movie.
 */

import { View, Text, ScrollView, Image, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
import { Layout } from '../../src/components/layout';
import { useMovie } from '@mediaserver/api-client';

export default function MovieDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: movie, isLoading, error } = useMovie(id ?? '');

  if (isLoading) {
    return (
      <Layout>
        <View className="flex-1 bg-zinc-900 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </Layout>
    );
  }

  if (error || !movie) {
    return (
      <Layout>
        <View className="flex-1 bg-zinc-900 items-center justify-center px-4">
          <Text className="text-white text-xl mb-2">Movie not found</Text>
          <Text className="text-zinc-400 text-center">
            The movie you're looking for doesn't exist or has been removed.
          </Text>
          <Link href="/movies" asChild>
            <Pressable className="mt-4 px-4 py-2 bg-indigo-600 rounded-lg">
              <Text className="text-white">Back to Movies</Text>
            </Pressable>
          </Link>
        </View>
      </Layout>
    );
  }

  const backdropUrl = movie.backdropPath
    ? `http://localhost:3000/api/images/movies/${movie.id}/backdrop?size=large`
    : null;

  const posterUrl = movie.posterPath
    ? `http://localhost:3000/api/images/movies/${movie.id}/poster?size=large`
    : null;

  return (
    <Layout>
      <ScrollView className="flex-1 bg-zinc-900">
        {/* Hero Section with Backdrop */}
        <View className="relative h-[50vh] sm:h-[60vh]">
          {backdropUrl && (
            <Image
              source={{ uri: backdropUrl }}
              className="absolute inset-0 w-full h-full"
              resizeMode="cover"
            />
          )}
          <View className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
          <View className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-zinc-950/40 to-transparent" />
        </View>

        {/* Content */}
        <View className="px-4 sm:px-6 lg:px-8 -mt-32 relative">
          <View className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Poster */}
            {posterUrl && (
              <View className="hidden lg:flex w-64 h-96 rounded-xl overflow-hidden shadow-2xl">
                <Image
                  source={{ uri: posterUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Info */}
            <View className="flex-1">
              <Text className="text-3xl sm:text-4xl font-bold text-white">
                {movie.title}
              </Text>

              {/* Metadata */}
              <View className="flex flex-row flex-wrap items-center gap-3 mt-3">
                {movie.year && (
                  <Text className="text-zinc-400">{movie.year}</Text>
                )}
                {movie.runtime && (
                  <Text className="text-zinc-400">{movie.runtime} min</Text>
                )}
                {movie.voteAverage && (
                  <View className="flex flex-row items-center gap-1">
                    <Text className="text-yellow-400">★</Text>
                    <Text className="text-white">{movie.voteAverage.toFixed(1)}</Text>
                  </View>
                )}
              </View>

              {/* Overview */}
              {movie.overview && (
                <Text className="text-zinc-300 mt-4 text-lg leading-relaxed">
                  {movie.overview}
                </Text>
              )}

              {/* Actions */}
              <View className="flex flex-row gap-3 mt-6">
                <Pressable className="flex flex-row items-center gap-2 px-6 py-3 bg-white rounded-lg active:bg-zinc-200">
                  <svg
                    className="w-6 h-6 text-black"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <Text className="text-black font-semibold">Play</Text>
                </Pressable>
                <Pressable className="flex flex-row items-center gap-2 px-6 py-3 bg-zinc-700 rounded-lg active:bg-zinc-600">
                  <Text className="text-white font-semibold">Add to List</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Spacer */}
        <View className="h-16" />
      </ScrollView>
    </Layout>
  );
}
