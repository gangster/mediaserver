/**
 * Search screen - Global search across movies, TV shows, and episodes.
 */

import { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSearch, useTrending } from '@mediaserver/api-client';
import { MediaCard } from '@mediaserver/ui';

/** Simple debounce hook */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w185';

interface SearchResult {
  type: 'movie' | 'tvshow' | 'episode';
  id: string;
  title: string;
  year?: number | null;
  posterPath?: string | null;
  showId?: string;
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

interface TrendingItem {
  type: 'movie' | 'tvshow';
  id: string;
  title: string;
  posterPath?: string | null;
  year?: number | null;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);

  const searchQuery = useSearch(
    { query: debouncedQuery, limit: 20 },
    debouncedQuery.length > 0
  );

  const trendingQuery = useTrending(10);

  const handleMoviePress = (id: string) => {
    router.push(`/movies/${id}`);
  };

  const handleShowPress = (id: string) => {
    router.push(`/tv/${id}`);
  };

  const handleResultPress = (result: SearchResult) => {
    if (result.type === 'movie') {
      handleMoviePress(result.id);
    } else if (result.type === 'tvshow') {
      handleShowPress(result.id);
    } else if (result.type === 'episode' && result.showId) {
      handleShowPress(result.showId);
    }
  };

  const searchResults = searchQuery.data as {
    movies: SearchResult[];
    shows: SearchResult[];
    episodes: SearchResult[];
  } | undefined;

  const trendingData = trendingQuery.data as {
    movies: TrendingItem[];
    shows: TrendingItem[];
  } | undefined;

  const hasResults = searchResults && (
    searchResults.movies.length > 0 ||
    searchResults.shows.length > 0 ||
    searchResults.episodes.length > 0
  );

  const isSearching = debouncedQuery.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1">
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-3xl font-bold text-white">Search</Text>
        </View>

        {/* Search input */}
        <View className="px-4 mb-4">
          <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <Text className="pl-4 text-zinc-500 text-lg">🔍</Text>
            <TextInput
              className="flex-1 px-3 py-3 text-white"
              placeholder="Search movies, TV shows..."
              placeholderTextColor="#71717a"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} className="pr-4">
                <Text className="text-zinc-500 text-lg">✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Loading state */}
          {searchQuery.isLoading && (
            <View className="py-20 items-center">
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          )}

          {/* Search results */}
          {isSearching && !searchQuery.isLoading && (
            <>
              {hasResults ? (
                <>
                  {/* Movies results */}
                  {searchResults.movies.length > 0 && (
                    <View className="mb-6">
                      <Text className="text-lg font-semibold text-white px-4 mb-3">
                        Movies ({searchResults.movies.length})
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                      >
                        {searchResults.movies.map((movie) => (
                          <MediaCard
                            key={movie.id}
                            posterUrl={movie.posterPath ? `${IMAGE_BASE_URL}${movie.posterPath}` : undefined}
                            title={movie.title}
                            subtitle={movie.year?.toString()}
                            onPress={() => handleResultPress(movie)}
                            className="mr-4"
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* TV Shows results */}
                  {searchResults.shows.length > 0 && (
                    <View className="mb-6">
                      <Text className="text-lg font-semibold text-white px-4 mb-3">
                        TV Shows ({searchResults.shows.length})
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                      >
                        {searchResults.shows.map((show) => (
                          <MediaCard
                            key={show.id}
                            posterUrl={show.posterPath ? `${IMAGE_BASE_URL}${show.posterPath}` : undefined}
                            title={show.title}
                            subtitle={show.year?.toString()}
                            onPress={() => handleResultPress(show)}
                            className="mr-4"
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Episodes results */}
                  {searchResults.episodes.length > 0 && (
                    <View className="mb-6">
                      <Text className="text-lg font-semibold text-white px-4 mb-3">
                        Episodes ({searchResults.episodes.length})
                      </Text>
                      <View className="px-4">
                        {searchResults.episodes.map((episode) => (
                          <Pressable
                            key={episode.id}
                            className="flex-row items-center bg-zinc-900 rounded-xl p-3 mb-2 active:bg-zinc-800"
                            onPress={() => handleResultPress(episode)}
                          >
                            <View className="flex-1">
                              <Text className="text-white font-medium" numberOfLines={1}>
                                {episode.showTitle} - S{episode.seasonNumber}E{episode.episodeNumber}
                              </Text>
                              {episode.title && (
                                <Text className="text-zinc-500 text-sm" numberOfLines={1}>
                                  {episode.title}
                                </Text>
                              )}
                            </View>
                            <Text className="text-zinc-500 ml-2">→</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <View className="py-20 items-center px-4">
                  <Text className="text-zinc-500 text-center">
                    No results found for &quot;{debouncedQuery}&quot;
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Trending (when not searching) */}
          {!isSearching && trendingData && (
            <>
              {/* Trending Movies */}
              {trendingData.movies.length > 0 && (
                <View className="mb-6">
                  <Text className="text-lg font-semibold text-white px-4 mb-3">
                    Popular Movies
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                  >
                    {trendingData.movies.map((movie) => (
                      <MediaCard
                        key={movie.id}
                        posterUrl={movie.posterPath ? `${IMAGE_BASE_URL}${movie.posterPath}` : undefined}
                        title={movie.title}
                        subtitle={movie.year?.toString()}
                        onPress={() => handleMoviePress(movie.id)}
                        className="mr-4"
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Trending Shows */}
              {trendingData.shows.length > 0 && (
                <View className="mb-6">
                  <Text className="text-lg font-semibold text-white px-4 mb-3">
                    Popular TV Shows
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                  >
                    {trendingData.shows.map((show) => (
                      <MediaCard
                        key={show.id}
                        posterUrl={show.posterPath ? `${IMAGE_BASE_URL}${show.posterPath}` : undefined}
                        title={show.title}
                        subtitle={show.year?.toString()}
                        onPress={() => handleShowPress(show.id)}
                        className="mr-4"
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}

          {/* Empty state when no trending */}
          {!isSearching && !trendingQuery.isLoading && !trendingData && (
            <View className="py-20 items-center px-4">
              <Text className="text-zinc-500 text-center">
                Type to search your library
              </Text>
            </View>
          )}

          {/* Footer spacer */}
          <View className="h-8" />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
