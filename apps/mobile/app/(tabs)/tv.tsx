/**
 * TV Shows screen - displays the TV show library.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useShows, useShowGenres, useContinueWatching, useRecentShows } from '@mediaserver/api-client';
import { MediaRow, MediaGrid } from '@mediaserver/ui';

type SortOption = 'addedAt' | 'title' | 'year' | 'rating';
type ViewMode = 'grid' | 'rows';

interface ShowItem {
  id: string;
  title: string;
  posterPath?: string | null;
  year?: number | null;
  voteAverage?: number | null;
  seasonCount?: number;
  episodeCount?: number;
}

interface ContinueWatchingItem {
  type: string;
  id: string;
  showId?: string;
  title: string;
  showTitle?: string;
  posterPath?: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
  progress?: { percentage: number };
}

export default function TVScreen() {
  const [sort, setSort] = useState<SortOption>('addedAt');
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>('rows');

  // Fetch data
  const continueWatchingQuery = useContinueWatching(10);
  const recentShowsQuery = useRecentShows(20);
  const genresQuery = useShowGenres();
  const showsQuery = useShows({
    genre: selectedGenre,
    sort,
    direction: sort === 'title' ? 'asc' : 'desc',
    limit: 50,
  });

  // Filter continue watching to just episodes
  const continueWatchingEpisodes = ((continueWatchingQuery.data as ContinueWatchingItem[] | undefined) ?? [])
    .filter((item) => item.type === 'episode');

  const handleShowPress = (show: { id: string }) => {
    router.push(`/tv/${show.id}`);
  };

  const handleEpisodePress = (episode: ContinueWatchingItem) => {
    if (episode.showId) {
      router.push(`/tv/${episode.showId}`);
    }
  };

  const isLoading = showsQuery.isLoading || recentShowsQuery.isLoading;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-3xl font-bold text-white">TV Shows</Text>
        </View>

        {/* View mode and sort controls */}
        <View className="flex-row items-center px-4 py-2">
          {/* View mode toggle */}
          <View className="flex-row bg-zinc-900 rounded-lg p-1 mr-3">
            <Pressable
              className={`px-3 py-1.5 rounded-md ${viewMode === 'rows' ? 'bg-zinc-700' : ''}`}
              onPress={() => setViewMode('rows')}
            >
              <Text className="text-white text-sm">Rows</Text>
            </Pressable>
            <Pressable
              className={`px-3 py-1.5 rounded-md ${viewMode === 'grid' ? 'bg-zinc-700' : ''}`}
              onPress={() => setViewMode('grid')}
            >
              <Text className="text-white text-sm">Grid</Text>
            </Pressable>
          </View>

          {/* Sort options */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
            <View className="flex-row">
              {(['addedAt', 'title', 'year', 'rating'] as const).map((option) => (
                <Pressable
                  key={option}
                  className={`px-3 py-1.5 rounded-full mr-2 ${sort === option ? 'bg-primary' : 'bg-zinc-800'}`}
                  onPress={() => setSort(option)}
                >
                  <Text className={`text-sm ${sort === option ? 'text-white' : 'text-zinc-400'}`}>
                    {option === 'addedAt' ? 'Recent' : option === 'rating' ? 'Rating' : option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Genre filter */}
        {genresQuery.data && (genresQuery.data as string[]).length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-4 py-2"
          >
            <Pressable
              className={`px-3 py-1.5 rounded-full mr-2 ${!selectedGenre ? 'bg-primary' : 'bg-zinc-800'}`}
              onPress={() => setSelectedGenre(undefined)}
            >
              <Text className={`text-sm ${!selectedGenre ? 'text-white' : 'text-zinc-400'}`}>
                All
              </Text>
            </Pressable>
            {(genresQuery.data as string[]).map((genre) => (
              <Pressable
                key={genre}
                className={`px-3 py-1.5 rounded-full mr-2 ${selectedGenre === genre ? 'bg-primary' : 'bg-zinc-800'}`}
                onPress={() => setSelectedGenre(genre === selectedGenre ? undefined : genre)}
              >
                <Text className={`text-sm ${selectedGenre === genre ? 'text-white' : 'text-zinc-400'}`}>
                  {genre}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Loading state */}
        {isLoading && (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        )}

        {/* Content */}
        {!isLoading && viewMode === 'rows' && (
          <>
            {/* Continue Watching Episodes */}
            {continueWatchingEpisodes.length > 0 && (
              <MediaRow
                title="Continue Watching"
                subtitle="Pick up where you left off"
                data={continueWatchingEpisodes.map((item) => ({
                  id: item.id,
                  title: `${item.showTitle} - S${item.seasonNumber}E${item.episodeNumber}`,
                  subtitle: item.title ?? undefined,
                  posterPath: item.posterPath,
                  progress: item.progress?.percentage,
                }))}
                onItemPress={() => handleEpisodePress(continueWatchingEpisodes[0]!)}
              />
            )}

            {/* Recently Added */}
            {recentShowsQuery.data && (recentShowsQuery.data as ShowItem[]).length > 0 && (
              <MediaRow
                title="Recently Added"
                data={(recentShowsQuery.data as ShowItem[]).map((show) => ({
                  id: show.id,
                  title: show.title,
                  posterPath: show.posterPath,
                  year: show.year,
                  rating: show.voteAverage,
                  subtitle: show.seasonCount ? `${show.seasonCount} Season${show.seasonCount > 1 ? 's' : ''}` : undefined,
                }))}
                onItemPress={handleShowPress}
              />
            )}

            {/* All Shows by genre/sort */}
            {showsQuery.data && (showsQuery.data as { items: ShowItem[] }).items?.length > 0 && (
              <MediaRow
                title={selectedGenre ? `${selectedGenre} Shows` : 'All Shows'}
                data={(showsQuery.data as { items: ShowItem[] }).items.map((show) => ({
                  id: show.id,
                  title: show.title,
                  posterPath: show.posterPath,
                  year: show.year,
                  rating: show.voteAverage,
                }))}
                onItemPress={handleShowPress}
                showSeeAll={false}
              />
            )}
          </>
        )}

        {/* Grid view */}
        {!isLoading && viewMode === 'grid' && showsQuery.data && (showsQuery.data as { items: ShowItem[] }).items && (
          <View className="px-4 pb-8">
            <MediaGrid
              data={(showsQuery.data as { items: ShowItem[] }).items.map((show) => ({
                id: show.id,
                title: show.title,
                posterPath: show.posterPath,
                year: show.year,
                rating: show.voteAverage,
              }))}
              onItemPress={handleShowPress}
              cardSize="md"
            />
          </View>
        )}

        {/* Empty state */}
        {!isLoading && (!showsQuery.data || !(showsQuery.data as { items: ShowItem[] }).items?.length) && (
          <View className="py-20 items-center px-4">
            <Text className="text-zinc-500 text-center">
              No TV shows found. Add a library to get started.
            </Text>
          </View>
        )}

        {/* Footer spacer */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
