/**
 * Movies List Page
 *
 * Browse all movies in the library with filtering and sorting options.
 */

import { View, Text, ScrollView } from 'react-native';
import { Layout } from '../../src/components/layout';
import { useMovies } from '@mediaserver/api-client';
import { MediaCard, SkeletonMediaCard } from '@mediaserver/ui';

export default function MoviesPage() {
  const { data, isLoading } = useMovies({ limit: 50 });

  return (
    <Layout>
      <ScrollView className="flex-1 bg-zinc-950">
        {/* Header */}
        <View className="px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <Text className="text-2xl sm:text-3xl font-bold text-white">Movies</Text>
          <Text className="text-zinc-400 mt-1">
            {data?.total ?? 0} movies in your library
          </Text>
        </View>

        {/* Grid */}
        <View className="px-4 sm:px-6 lg:px-8 pb-8">
          <View className="flex flex-row flex-wrap gap-4">
            {isLoading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <View
                    key={i}
                    className="w-[calc(50%-8px)] sm:w-[calc(33.333%-11px)] md:w-[calc(25%-12px)] lg:w-[calc(20%-13px)] xl:w-[calc(16.666%-13px)]"
                  >
                    <SkeletonMediaCard />
                  </View>
                ))
              : data?.items?.map((movie: { id: string; title: string; year?: number | null; posterPath?: string | null; voteAverage?: number | null }) => (
                  <View
                    key={movie.id}
                    className="w-[calc(50%-8px)] sm:w-[calc(33.333%-11px)] md:w-[calc(25%-12px)] lg:w-[calc(20%-13px)] xl:w-[calc(16.666%-13px)]"
                  >
                    <MediaCard
                      posterUrl={
                        movie.posterPath
                          ? `http://localhost:3000/api/images/movies/${movie.id}/poster?size=medium`
                          : null
                      }
                      title={movie.title}
                      subtitle={movie.year?.toString()}
                      rating={movie.voteAverage ?? undefined}
                    />
                  </View>
                ))}
          </View>
        </View>
      </ScrollView>
    </Layout>
  );
}
