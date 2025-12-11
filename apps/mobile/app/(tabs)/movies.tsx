/**
 * Movies screen - displays the movie library.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMovies, useMovieGenres, useContinueWatching, useRecentMovies } from '@mediaserver/api-client';
import { MediaRow, MediaGrid } from '@mediaserver/ui';

type SortOption = 'addedAt' | 'title' | 'year' | 'rating';
type ViewMode = 'grid' | 'rows';

interface MovieItem {
  id: string;
  title: string;
  posterPath?: string | null;
  year?: number | null;
  voteAverage?: number | null;
}

interface ContinueWatchingItem {
  type: string;
  id: string;
  title: string;
  posterPath?: string | null;
  year?: number | null;
  progress?: { percentage: number };
}

export default function MoviesScreen() {
  const [sort, setSort] = useState<SortOption>('addedAt');
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>('rows');

  // Fetch data
  const continueWatchingQuery = useContinueWatching(10);
  const recentMoviesQuery = useRecentMovies(20);
  const genresQuery = useMovieGenres();
  const moviesQuery = useMovies({
    genre: selectedGenre,
    sort,
    direction: sort === 'title' ? 'asc' : 'desc',
    limit: 50,
  });

  // Filter continue watching to just movies
  const continueWatchingMovies = ((continueWatchingQuery.data as ContinueWatchingItem[] | undefined) ?? [])
    .filter((item) => item.type === 'movie');

  const handleMoviePress = (movie: { id: string }) => {
    router.push(`/movies/${movie.id}`);
  };

  const isLoading = moviesQuery.isLoading || recentMoviesQuery.isLoading;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-3xl font-bold text-white">Movies</Text>
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
            {/* Continue Watching (if any) */}
            {continueWatchingMovies.length > 0 && (
              <MediaRow
                title="Continue Watching"
                data={continueWatchingMovies.map((item) => ({
                  id: item.id,
                  title: item.title,
                  posterPath: item.posterPath,
                  year: item.year,
                  progress: item.progress?.percentage,
                }))}
                onItemPress={handleMoviePress}
              />
            )}

            {/* Recently Added */}
            {recentMoviesQuery.data && (recentMoviesQuery.data as MovieItem[]).length > 0 && (
              <MediaRow
                title="Recently Added"
                data={(recentMoviesQuery.data as MovieItem[]).map((movie) => ({
                  id: movie.id,
                  title: movie.title,
                  posterPath: movie.posterPath,
                  year: movie.year,
                  rating: movie.voteAverage,
                }))}
                onItemPress={handleMoviePress}
              />
            )}

            {/* All Movies by genre/sort */}
            {moviesQuery.data && (moviesQuery.data as { items: MovieItem[] }).items?.length > 0 && (
              <MediaRow
                title={selectedGenre ? `${selectedGenre} Movies` : 'All Movies'}
                data={(moviesQuery.data as { items: MovieItem[] }).items.map((movie) => ({
                  id: movie.id,
                  title: movie.title,
                  posterPath: movie.posterPath,
                  year: movie.year,
                  rating: movie.voteAverage,
                }))}
                onItemPress={handleMoviePress}
                showSeeAll={false}
              />
            )}
          </>
        )}

        {/* Grid view */}
        {!isLoading && viewMode === 'grid' && moviesQuery.data && (moviesQuery.data as { items: MovieItem[] }).items && (
          <View className="px-4 pb-8">
            <MediaGrid
              data={(moviesQuery.data as { items: MovieItem[] }).items.map((movie) => ({
                id: movie.id,
                title: movie.title,
                posterPath: movie.posterPath,
                year: movie.year,
                rating: movie.voteAverage,
              }))}
              onItemPress={handleMoviePress}
              cardSize="md"
            />
          </View>
        )}

        {/* Empty state */}
        {!isLoading && (!moviesQuery.data || !(moviesQuery.data as { items: MovieItem[] }).items?.length) && (
          <View className="py-20 items-center px-4">
            <Text className="text-zinc-500 text-center">
              No movies found. Add a library to get started.
            </Text>
          </View>
        )}

        {/* Footer spacer */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
