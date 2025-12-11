/**
 * Movie detail screen.
 */

import { View, Text, ScrollView, Pressable, ActivityIndicator, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useMovie, useMarkMovieWatched, useMarkMovieUnwatched, useCreateSession } from '@mediaserver/api-client';
import { Button, Badge, ProgressBar, CastCard } from '@mediaserver/ui';

const { width: screenWidth } = Dimensions.get('window');
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const movieQuery = useMovie(id ?? '', !!id);
  const markWatched = useMarkMovieWatched();
  const markUnwatched = useMarkMovieUnwatched();
  const createSession = useCreateSession();

  const movie = movieQuery.data as {
    id: string;
    title: string;
    tagline?: string;
    overview?: string;
    year?: number;
    runtime?: number;
    voteAverage?: number;
    contentRating?: string;
    posterPath?: string;
    backdropPath?: string;
    genres?: string[];
    videoCodec?: string;
    audioCodec?: string;
    resolution?: string;
    watchProgress?: {
      position: number;
      duration: number;
      percentage: number;
      isWatched: boolean;
    } | null;
  } | undefined;

  const handlePlay = async () => {
    if (!movie) return;

    try {
      const session = await createSession.mutateAsync({
        mediaType: 'movie',
        mediaId: movie.id,
        startPosition: movie.watchProgress?.position ?? 0,
      });

      router.push(`/watch/movie/${movie.id}?sessionId=${session.sessionId}`);
    } catch (error) {
      console.error('Failed to create playback session:', error);
    }
  };

  const handleToggleWatched = async () => {
    if (!movie) return;

    if (movie.watchProgress?.isWatched) {
      await markUnwatched.mutateAsync({ id: movie.id });
    } else {
      await markWatched.mutateAsync({ id: movie.id });
    }
    movieQuery.refetch();
  };

  if (movieQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    );
  }

  if (!movie) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-zinc-500">Movie not found</Text>
      </SafeAreaView>
    );
  }

  const backdropUrl = movie.backdropPath
    ? `${IMAGE_BASE_URL}/w1280${movie.backdropPath}`
    : null;

  const posterUrl = movie.posterPath
    ? `${IMAGE_BASE_URL}/w342${movie.posterPath}`
    : null;

  const hasProgress = movie.watchProgress && movie.watchProgress.percentage > 0 && !movie.watchProgress.isWatched;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
          headerTintColor: '#fff',
        }}
      />

      <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
        {/* Backdrop */}
        <View className="relative" style={{ height: screenWidth * 0.56 }}>
          {backdropUrl ? (
            <Image
              source={{ uri: backdropUrl }}
              className="absolute inset-0 w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="absolute inset-0 bg-zinc-900" />
          )}
          {/* Gradient overlay */}
          <View className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </View>

        {/* Content */}
        <View className="px-4 -mt-20 relative z-10">
          <View className="flex-row">
            {/* Poster */}
            <View className="w-28 h-42 rounded-xl overflow-hidden bg-zinc-800 shadow-lg">
              {posterUrl ? (
                <Image
                  source={{ uri: posterUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center">
                  <Text className="text-zinc-600 text-4xl">🎬</Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View className="flex-1 ml-4 justify-end pb-2">
              <Text className="text-2xl font-bold text-white" numberOfLines={2}>
                {movie.title}
              </Text>

              <View className="flex-row items-center mt-2 flex-wrap">
                {movie.year && (
                  <Text className="text-zinc-400 mr-3">{movie.year}</Text>
                )}
                {movie.runtime && (
                  <Text className="text-zinc-400 mr-3">{movie.runtime} min</Text>
                )}
                {movie.contentRating && (
                  <Badge variant="secondary" size="sm">
                    {movie.contentRating}
                  </Badge>
                )}
              </View>

              {movie.voteAverage && movie.voteAverage > 0 && (
                <View className="flex-row items-center mt-2">
                  <Text className="text-yellow-400 mr-1">★</Text>
                  <Text className="text-white font-semibold">{movie.voteAverage.toFixed(1)}</Text>
                  <Text className="text-zinc-500 ml-1">/10</Text>
                </View>
              )}
            </View>
          </View>

          {/* Watch progress */}
          {hasProgress && (
            <View className="mt-4">
              <ProgressBar
                value={movie.watchProgress!.percentage}
                variant="primary"
                size="sm"
                showLabel
                labelPosition="right"
              />
            </View>
          )}

          {/* Action buttons */}
          <View className="flex-row mt-6 space-x-3">
            <Button
              variant="primary"
              size="lg"
              onPress={handlePlay}
              loading={createSession.isPending}
              className="flex-1"
            >
              {hasProgress ? '▶ Resume' : '▶ Play'}
            </Button>

            <Pressable
              className="w-12 h-12 rounded-lg bg-zinc-800 items-center justify-center active:bg-zinc-700"
              onPress={handleToggleWatched}
            >
              <Text className="text-xl">
                {movie.watchProgress?.isWatched ? '✓' : '○'}
              </Text>
            </Pressable>
          </View>

          {/* Tagline */}
          {movie.tagline && (
            <Text className="text-zinc-400 italic mt-6 text-center">
              &quot;{movie.tagline}&quot;
            </Text>
          )}

          {/* Overview */}
          {movie.overview && (
            <View className="mt-6">
              <Text className="text-lg font-semibold text-white mb-2">Overview</Text>
              <Text className="text-zinc-300 leading-6">{movie.overview}</Text>
            </View>
          )}

          {/* Genres */}
          {movie.genres && movie.genres.length > 0 && (
            <View className="mt-6">
              <Text className="text-lg font-semibold text-white mb-2">Genres</Text>
              <View className="flex-row flex-wrap">
                {movie.genres.map((genre: string) => (
                  <Badge key={genre} variant="secondary" size="md" className="mr-2 mb-2">
                    {genre}
                  </Badge>
                ))}
              </View>
            </View>
          )}

          {/* Technical info */}
          <View className="mt-6">
            <Text className="text-lg font-semibold text-white mb-2">Technical</Text>
            <View className="flex-row flex-wrap">
              {movie.videoCodec && (
                <Badge variant="default" size="sm" className="mr-2 mb-2">
                  {movie.videoCodec}
                </Badge>
              )}
              {movie.audioCodec && (
                <Badge variant="default" size="sm" className="mr-2 mb-2">
                  {movie.audioCodec}
                </Badge>
              )}
              {movie.resolution && (
                <Badge variant="default" size="sm" className="mr-2 mb-2">
                  {movie.resolution}
                </Badge>
              )}
            </View>
          </View>

          {/* Footer spacer */}
          <View className="h-20" />
        </View>
      </ScrollView>
    </>
  );
}

