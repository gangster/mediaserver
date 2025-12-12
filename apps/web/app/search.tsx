/**
 * Search Page
 *
 * Full-screen search with results grid.
 */

import { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Layout } from '../src/components/layout';
import { useSearch } from '@mediaserver/api-client';
import { useDebounce } from '../src/hooks';
import { MediaCard, SkeletonMediaCard } from '@mediaserver/ui';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = useSearch(
    { query: debouncedQuery, limit: 50 },
    debouncedQuery.length > 0
  );

  const results = data?.results ?? [];

  const handleItemPress = (item: { id: string; type: string }) => {
    const path = item.type === 'movie' ? `/movies/${item.id}` : `/tv/${item.id}`;
    router.push(path as '/movies/[id]');
  };

  return (
    <Layout>
      <ScrollView className="flex-1 bg-zinc-950">
        {/* Header */}
        <View className="px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <Text className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Search
          </Text>

          {/* Search Input */}
          <View className="flex flex-row items-center gap-3 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <svg
              className="w-5 h-5 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search movies and shows..."
              placeholderTextColor="#71717a"
              className="flex-1 text-white text-lg"
              autoFocus
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')}>
                <svg
                  className="w-5 h-5 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Pressable>
            )}
          </View>
        </View>

        {/* Results */}
        <View className="px-4 sm:px-6 lg:px-8 pb-8">
          {query.length === 0 ? (
            <View className="items-center py-16">
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </View>
              <Text className="text-zinc-400 text-lg">Start typing to search</Text>
              <Text className="text-zinc-500 mt-1">
                Search across movies and TV shows
              </Text>
            </View>
          ) : isLoading ? (
            <View className="flex flex-row flex-wrap gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <View
                  key={i}
                  className="w-[calc(50%-8px)] sm:w-[calc(33.333%-11px)] md:w-[calc(25%-12px)] lg:w-[calc(20%-13px)] xl:w-[calc(16.666%-13px)]"
                >
                  <SkeletonMediaCard />
                </View>
              ))}
            </View>
          ) : results.length === 0 ? (
            <View className="items-center py-16">
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
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </View>
              <Text className="text-zinc-400 text-lg">No results found</Text>
              <Text className="text-zinc-500 mt-1">
                Try different keywords or check your spelling
              </Text>
            </View>
          ) : (
            <>
              <Text className="text-zinc-400 mb-4">
                {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
              </Text>
              <View className="flex flex-row flex-wrap gap-4">
                {results.map((item: { id: string; type: string; title: string; subtitle?: string | null; posterPath?: string | null }) => (
                  <Pressable
                    key={`${item.type}-${item.id}`}
                    onPress={() => handleItemPress(item)}
                    className="w-[calc(50%-8px)] sm:w-[calc(33.333%-11px)] md:w-[calc(25%-12px)] lg:w-[calc(20%-13px)] xl:w-[calc(16.666%-13px)]"
                  >
                    <MediaCard
                      posterUrl={
                        item.posterPath
                          ? `http://localhost:3000/api/images/${item.type === 'movie' ? 'movies' : 'shows'}/${item.id}/poster?size=medium`
                          : null
                      }
                      title={item.title}
                      subtitle={item.subtitle ?? undefined}
                    />
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </Layout>
  );
}
