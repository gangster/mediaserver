/**
 * Home screen - Continue Watching, Recently Added, library stats.
 */

import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { BRANDING } from '@mediaserver/core';
import { useAuthStore } from '../../src/stores/auth';
import {
  useContinueWatching,
  useRecentMovies,
  useRecentShows,
  useServerStats,
} from '@mediaserver/api-client';
import { MediaRow } from '@mediaserver/ui';

// Stats card component
function StatCard({ label, value, loading }: { label: string; value: number; loading?: boolean }) {
  return (
    <View className="bg-zinc-900 rounded-xl p-4 flex-1 mx-1">
      {loading ? (
        <ActivityIndicator size="small" color="#6366f1" />
      ) : (
        <Text className="text-3xl font-bold text-white">{value.toLocaleString()}</Text>
      )}
      <Text className="text-zinc-400 text-sm">{label}</Text>
    </View>
  );
}

interface ContinueWatchingItem {
  type: string;
  id: string;
  title: string;
  showTitle?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  showId?: string;
  progress?: {
    position: number;
    duration: number;
    percentage: number;
  };
}

interface MediaItem {
  id: string;
  title: string;
  posterPath?: string | null;
  year?: number | null;
  voteAverage?: number | null;
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data
  const statsQuery = useServerStats();
  const continueWatchingQuery = useContinueWatching(10);
  const recentMoviesQuery = useRecentMovies(10);
  const recentShowsQuery = useRecentShows(10);

  const stats = statsQuery.data as {
    movies: number;
    shows: number;
    episodes: number;
  } | undefined;

  const continueWatching = (continueWatchingQuery.data ?? []) as ContinueWatchingItem[];
  const recentMovies = (recentMoviesQuery.data ?? []) as MediaItem[];
  const recentShows = (recentShowsQuery.data ?? []) as MediaItem[];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      statsQuery.refetch(),
      continueWatchingQuery.refetch(),
      recentMoviesQuery.refetch(),
      recentShowsQuery.refetch(),
    ]);
    setRefreshing(false);
  }, [statsQuery, continueWatchingQuery, recentMoviesQuery, recentShowsQuery]);

  const handleMoviePress = (movie: { id: string }) => {
    router.push(`/movies/${movie.id}`);
  };

  const handleShowPress = (show: { id: string }) => {
    router.push(`/tv/${show.id}`);
  };

  const handleContinueWatchingPress = (item: ContinueWatchingItem) => {
    if (item.type === 'movie') {
      router.push(`/movies/${item.id}`);
    } else if (item.showId) {
      router.push(`/tv/${item.showId}`);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
            colors={['#6366f1']}
          />
        }
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-6">
          <Text className="text-zinc-400 text-sm">Welcome back,</Text>
          <Text className="text-2xl font-bold text-white">
            {user?.displayName ?? 'User'}
          </Text>
        </View>

        {/* Stats */}
        <View className="flex-row px-3 mb-8">
          <StatCard
            label="Movies"
            value={stats?.movies ?? 0}
            loading={statsQuery.isLoading}
          />
          <StatCard
            label="TV Shows"
            value={stats?.shows ?? 0}
            loading={statsQuery.isLoading}
          />
          <StatCard
            label="Episodes"
            value={stats?.episodes ?? 0}
            loading={statsQuery.isLoading}
          />
        </View>

        {/* Continue Watching */}
        <MediaRow
          title="Continue Watching"
          data={continueWatching.map((item) => ({
            id: item.id,
            title: item.type === 'episode'
              ? `${item.showTitle} - S${item.seasonNumber}E${item.episodeNumber}`
              : item.title,
            subtitle: item.type === 'episode' ? item.title : undefined,
            posterPath: item.posterPath,
            progress: item.progress?.percentage,
          }))}
          onItemPress={handleContinueWatchingPress as (item: { id: string }) => void}
          loading={continueWatchingQuery.isLoading}
          emptyMessage="No items in progress. Start watching something!"
          showSeeAll={false}
        />

        {/* Recently Added Movies */}
        {recentMovies.length > 0 && (
          <MediaRow
            title="Recently Added Movies"
            data={recentMovies.map((movie) => ({
              id: movie.id,
              title: movie.title,
              posterPath: movie.posterPath,
              year: movie.year,
              rating: movie.voteAverage,
            }))}
            onItemPress={handleMoviePress}
            onSeeAllPress={() => router.push('/(tabs)/movies')}
            loading={recentMoviesQuery.isLoading}
          />
        )}

        {/* Recently Added TV Shows */}
        {recentShows.length > 0 && (
          <MediaRow
            title="Recently Added Shows"
            data={recentShows.map((show) => ({
              id: show.id,
              title: show.title,
              posterPath: show.posterPath,
              year: show.year,
              rating: show.voteAverage,
            }))}
            onItemPress={handleShowPress}
            onSeeAllPress={() => router.push('/(tabs)/tv')}
            loading={recentShowsQuery.isLoading}
          />
        )}

        {/* Empty state when no content */}
        {!continueWatchingQuery.isLoading &&
         !recentMoviesQuery.isLoading &&
         !recentShowsQuery.isLoading &&
         continueWatching.length === 0 &&
         recentMovies.length === 0 &&
         recentShows.length === 0 && (
          <View className="px-4 py-12 items-center">
            <Text className="text-zinc-500 text-center text-lg mb-2">
              Your library is empty
            </Text>
            <Text className="text-zinc-600 text-center">
              Add a library in settings to get started
            </Text>
          </View>
        )}

        {/* Footer spacer */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
