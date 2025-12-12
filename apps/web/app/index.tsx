/**
 * Web App Home Screen
 *
 * Premium home experience with hero banner, multiple content sections,
 * and user-customizable visibility preferences.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Link, useRouter, Redirect } from 'expo-router';
import {
  useLibraries,
  useMovies,
  useShows,
  useRecentMovies,
  useRecentShows,
  useContinueWatching,
} from '@mediaserver/api-client';

import { useAuth } from '../src/hooks/useAuth';
import { usePreferencesStore } from '../src/stores/preferences';
import { Layout } from '../src/components/layout';
import { StatCard } from '../src/components/home';
import { HomeSettingsPanel, HomeSettingsButton } from '../src/components/home';
import { WebMediaRow, WebHeroBanner, type BannerItem } from '../src/components/media';
import type { MediaRowItem } from '@mediaserver/ui';

/**
 * Get time-based greeting
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Convert movie to MediaRowItem
 */
function movieToRowItem(movie: {
  id: string;
  title: string;
  year?: number | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  voteAverage?: number | null;
  overview?: string | null;
}): MediaRowItem {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year,
    posterPath: movie.posterPath,
    rating: movie.voteAverage,
  };
}

/**
 * Convert show to MediaRowItem
 */
function showToRowItem(show: {
  id: string;
  title: string;
  year?: number | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  voteAverage?: number | null;
  overview?: string | null;
}): MediaRowItem {
  return {
    id: show.id,
    title: show.title,
    year: show.year,
    posterPath: show.posterPath,
    rating: show.voteAverage,
  };
}

/**
 * Convert movie to BannerItem
 */
function movieToBanner(movie: {
  id: string;
  title: string;
  year?: number | null;
  backdropPath?: string | null;
  voteAverage?: number | null;
  overview?: string | null;
}): BannerItem {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year,
    backdropPath: movie.backdropPath,
    voteAverage: movie.voteAverage,
    overview: movie.overview,
    type: 'movie',
  };
}

/**
 * Convert show to BannerItem
 */
function showToBanner(show: {
  id: string;
  title: string;
  year?: number | null;
  backdropPath?: string | null;
  voteAverage?: number | null;
  overview?: string | null;
}): BannerItem {
  return {
    id: show.id,
    title: show.title,
    year: show.year,
    backdropPath: show.backdropPath,
    voteAverage: show.voteAverage,
    overview: show.overview,
    type: 'show',
  };
}

/**
 * Home page
 */
export default function WebHomeScreen() {
  const router = useRouter();
  const { isAuthenticated, isInitialized, user, isAdmin } = useAuth();
  const { homePreferences } = usePreferencesStore();
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [hasCheckedTokens, setHasCheckedTokens] = useState(false);
  const [hasTokens, setHasTokens] = useState(false);

  // Check for stored tokens on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedAuth = localStorage.getItem('mediaserver-auth');
        const tokens = storedAuth
          ? JSON.parse(storedAuth)?.state?.tokens?.accessToken
          : null;
        setHasTokens(!!tokens);
      } catch {
        setHasTokens(false);
      }
      setHasCheckedTokens(true);
    }
  }, []);

  // Fetch library stats
  const { data: libraries, isLoading: librariesLoading } = useLibraries();

  // Fetch movies count
  const { data: moviesData, isLoading: moviesLoading } = useMovies({ limit: 1 });

  // Fetch shows count
  const { data: showsData, isLoading: showsLoading } = useShows({ limit: 1 });

  // Fetch continue watching
  const { data: continueWatching, isLoading: continueWatchingLoading } =
    useContinueWatching(10);

  // Fetch recently added movies
  const { data: recentMovies, isLoading: recentMoviesLoading } = useRecentMovies(20);

  // Fetch recently added shows
  const { data: recentShows, isLoading: recentShowsLoading } = useRecentShows(20);

  // Featured item for hero banner
  const featuredItem = useMemo(() => {
    if (!homePreferences.showHeroBanner) return null;

    const items: BannerItem[] = [];
    if (recentMovies?.length) {
      items.push(...recentMovies.slice(0, 5).map(movieToBanner));
    }
    if (recentShows?.length) {
      items.push(...recentShows.slice(0, 5).map(showToBanner));
    }

    // Filter to items with backdrop images
    const withBackdrop = items.filter((item) => item.backdropPath);
    if (withBackdrop.length === 0) return items[0] ?? null;

    // Pick a random one
    return withBackdrop[Math.floor(Math.random() * withBackdrop.length)];
  }, [recentMovies, recentShows, homePreferences.showHeroBanner]);

  // Continue watching items
  const continueWatchingItems = useMemo((): MediaRowItem[] => {
    if (!homePreferences.showContinueWatching || !continueWatching) return [];
    return continueWatching.map((item: { id: string; title: string; posterPath?: string | null; progress?: number }) => ({
      id: item.id,
      title: item.title,
      posterPath: item.posterPath,
      progress: item.progress,
    }));
  }, [continueWatching, homePreferences.showContinueWatching]);

  // Recent movies
  const recentMovieItems = useMemo((): MediaRowItem[] => {
    if (!homePreferences.showRecentMovies || !recentMovies) return [];
    return recentMovies.map(movieToRowItem);
  }, [recentMovies, homePreferences.showRecentMovies]);

  // Recent shows
  const recentShowItems = useMemo((): MediaRowItem[] => {
    if (!homePreferences.showRecentShows || !recentShows) return [];
    return recentShows.map(showToRowItem);
  }, [recentShows, homePreferences.showRecentShows]);

  // Handlers
  const handlePlay = useCallback(
    (item: BannerItem) => {
      // Navigate to movie/show detail page for now (watch page not implemented)
      const path = item.type === 'movie' ? `/movies/${item.id}` : `/tv/${item.id}`;
      router.push(path as '/movies/[id]');
    },
    [router]
  );

  const handleMoreInfo = useCallback(
    (item: BannerItem) => {
      const path = item.type === 'movie' ? `/movies/${item.id}` : `/tv/${item.id}`;
      router.push(path as '/movies/[id]');
    },
    [router]
  );

  const handleItemPress = useCallback(
    (item: MediaRowItem) => {
      // Determine type based on context or default to movie
      router.push(`/movies/${item.id}` as '/movies/[id]');
    },
    [router]
  );

  // Wait for client-side token check
  if (!hasCheckedTokens) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Redirect to login if no tokens
  if (!hasTokens) {
    return <Redirect href="/auth/login" />;
  }

  // Show loading while validating tokens
  if (!isInitialized) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="text-zinc-500 mt-4">Validating session...</Text>
      </View>
    );
  }

  // Redirect if not authenticated after init
  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  const hasContent = (moviesData?.total ?? 0) > 0 || (showsData?.total ?? 0) > 0;
  const greeting = getGreeting();
  const userName = user?.displayName || user?.email?.split('@')[0] || 'there';

  return (
    <Layout>
      <ScrollView className="flex-1 bg-zinc-950">
        {/* Hero Banner */}
        {homePreferences.showHeroBanner && featuredItem && (
          <WebHeroBanner
            item={featuredItem}
            onPlay={handlePlay}
            onMoreInfo={handleMoreInfo}
            variant="compact"
          />
        )}

        {/* Main content */}
        <View
          className={`gap-8 ${homePreferences.showHeroBanner && featuredItem ? 'pt-8' : 'pt-8'}`}
        >
          {/* Header with settings button */}
          <View className="px-4 sm:px-6 lg:px-8">
            <View className="flex flex-row items-center justify-between">
              <View>
                <Text className="text-2xl sm:text-3xl font-bold text-white">
                  {greeting}, {userName}
                </Text>
                <Text className="text-zinc-400 mt-1">
                  Here's what's happening with your media
                </Text>
              </View>
              <HomeSettingsButton onPress={() => setSettingsPanelOpen(true)} />
            </View>
          </View>

          {/* Stats row */}
          {homePreferences.showStats && (
            <View className="px-4 sm:px-6 lg:px-8">
              <View className="flex flex-row flex-wrap" style={{ gap: 16 }}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <StatCard
                    title="Movies"
                    value={moviesData?.total ?? 0}
                    color="bg-indigo-600"
                    isLoading={moviesLoading}
                    href="/movies"
                    icon={
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                        />
                      </svg>
                    }
                  />
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <StatCard
                    title="TV Shows"
                    value={showsData?.total ?? 0}
                    color="bg-purple-600"
                    isLoading={showsLoading}
                    href="/tv"
                    icon={
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    }
                  />
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <StatCard
                    title="Libraries"
                    value={libraries?.length ?? 0}
                    color="bg-emerald-600"
                    isLoading={librariesLoading}
                    href={isAdmin ? '/libraries' : undefined}
                    icon={
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                        />
                      </svg>
                    }
                  />
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <StatCard
                    title="Continue Watching"
                    value={continueWatchingItems.length}
                    color="bg-amber-600"
                    isLoading={continueWatchingLoading}
                    icon={
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    }
                  />
                </View>
              </View>
            </View>
          )}

          {/* Continue Watching */}
          {homePreferences.showContinueWatching &&
            (continueWatchingItems.length > 0 || continueWatchingLoading) && (
              <WebMediaRow
                title="Continue Watching"
                data={continueWatchingItems}
                isLoading={continueWatchingLoading}
                skeletonCount={5}
                onItemPress={handleItemPress}
              />
            )}

          {/* Recently Added Movies */}
          {homePreferences.showRecentMovies &&
            (recentMovieItems.length > 0 || recentMoviesLoading) && (
              <WebMediaRow
                title="Recently Added Movies"
                data={recentMovieItems}
                isLoading={recentMoviesLoading}
                seeAllLink="/movies"
                skeletonCount={8}
                onItemPress={handleItemPress}
              />
            )}

          {/* Recently Added Shows */}
          {homePreferences.showRecentShows &&
            (recentShowItems.length > 0 || recentShowsLoading) && (
              <WebMediaRow
                title="Recently Added Shows"
                data={recentShowItems}
                isLoading={recentShowsLoading}
                seeAllLink="/tv"
                skeletonCount={8}
                onItemPress={handleItemPress}
              />
            )}

          {/* Empty state when no content */}
          {!moviesLoading && !showsLoading && !librariesLoading && !hasContent && (
            <View className="px-4 sm:px-6 lg:px-8">
              <View className="bg-zinc-900/50 rounded-xl p-8 border border-zinc-800 items-center">
                <View className="w-16 h-16 mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-zinc-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                    />
                  </svg>
                </View>
                <Text className="text-xl font-semibold text-white mb-2">
                  No media yet
                </Text>
                <Text className="text-zinc-400 mb-6 text-center">
                  Add a library to start scanning your media collection
                </Text>
                {isAdmin && (
                  <Link href="/libraries" asChild>
                    <Pressable className="flex flex-row items-center gap-2 px-4 py-2 bg-emerald-600 active:bg-emerald-700 rounded-lg">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      <Text className="text-white">Add Library</Text>
                    </Pressable>
                  </Link>
                )}
              </View>
            </View>
          )}

          {/* Admin quick actions */}
          {isAdmin && (libraries?.length ?? 0) > 0 && (
            <View className="px-4 sm:px-6 lg:px-8 pb-8">
              <Text className="text-xl font-semibold text-white mb-4">
                Quick Actions
              </Text>
              <View className="flex flex-row flex-wrap gap-3">
                <Link href="/libraries" asChild>
                  <Pressable className="flex flex-row items-center gap-2 px-4 py-2 bg-zinc-800 active:bg-zinc-700 rounded-lg">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    <Text className="text-white">Manage Libraries</Text>
                  </Pressable>
                </Link>
                <Link href="/settings" asChild>
                  <Pressable className="flex flex-row items-center gap-2 px-4 py-2 bg-zinc-800 active:bg-zinc-700 rounded-lg">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <Text className="text-white">Settings</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Settings panel */}
      <HomeSettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
      />
    </Layout>
  );
}
