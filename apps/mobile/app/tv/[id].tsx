/**
 * TV Show detail screen.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useShow, useSeason, useNextEpisode, useCreateSession } from '@mediaserver/api-client';
import { Button, Badge, EpisodeCard } from '@mediaserver/ui';

const { width: screenWidth } = Dimensions.get('window');
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

interface Season {
  id: string;
  seasonNumber: number;
  name?: string;
  episodeCount: number;
  posterPath?: string;
}

interface Episode {
  id: string;
  episodeNumber: number;
  seasonNumber: number;
  title?: string;
  overview?: string;
  runtime?: number;
  stillPath?: string;
  watchProgress?: {
    percentage: number;
    isWatched: boolean;
  } | null;
}

export default function TVShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  const showQuery = useShow(id ?? '', !!id);
  const seasonQuery = useSeason(id ?? '', selectedSeason, !!id);
  const nextEpisodeQuery = useNextEpisode(id ?? '', !!id);
  const createSession = useCreateSession();

  const show = showQuery.data as {
    id: string;
    title: string;
    overview?: string;
    year?: number;
    status?: string;
    network?: string;
    voteAverage?: number;
    contentRating?: string;
    posterPath?: string;
    backdropPath?: string;
    genres?: string[];
    seasonCount: number;
    episodeCount: number;
    seasons?: Season[];
  } | undefined;

  const season = seasonQuery.data as {
    id: string;
    seasonNumber: number;
    name?: string;
    overview?: string;
    episodes?: Episode[];
  } | undefined;

  const nextEpisode = nextEpisodeQuery.data as Episode | null | undefined;

  const handlePlayNext = async () => {
    if (!nextEpisode) return;

    try {
      const session = await createSession.mutateAsync({
        mediaType: 'episode',
        mediaId: nextEpisode.id,
      });

      router.push(`/watch/episode/${nextEpisode.id}?sessionId=${session.sessionId}`);
    } catch (error) {
      console.error('Failed to create playback session:', error);
    }
  };

  const handlePlayEpisode = async (episode: Episode) => {
    try {
      const session = await createSession.mutateAsync({
        mediaType: 'episode',
        mediaId: episode.id,
      });

      router.push(`/watch/episode/${episode.id}?sessionId=${session.sessionId}`);
    } catch (error) {
      console.error('Failed to create playback session:', error);
    }
  };

  if (showQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    );
  }

  if (!show) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-zinc-500">Show not found</Text>
      </SafeAreaView>
    );
  }

  const backdropUrl = show.backdropPath
    ? `${IMAGE_BASE_URL}/w1280${show.backdropPath}`
    : null;

  const posterUrl = show.posterPath
    ? `${IMAGE_BASE_URL}/w342${show.posterPath}`
    : null;

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
                  <Text className="text-zinc-600 text-4xl">📺</Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View className="flex-1 ml-4 justify-end pb-2">
              <Text className="text-2xl font-bold text-white" numberOfLines={2}>
                {show.title}
              </Text>

              <View className="flex-row items-center mt-2 flex-wrap">
                {show.year && (
                  <Text className="text-zinc-400 mr-3">{show.year}</Text>
                )}
                {show.status && (
                  <Badge
                    variant={show.status === 'Ended' ? 'default' : 'success'}
                    size="sm"
                  >
                    {show.status}
                  </Badge>
                )}
              </View>

              <Text className="text-zinc-500 mt-1">
                {show.seasonCount} Season{show.seasonCount !== 1 ? 's' : ''} • {show.episodeCount} Episode{show.episodeCount !== 1 ? 's' : ''}
              </Text>

              {show.voteAverage && show.voteAverage > 0 && (
                <View className="flex-row items-center mt-2">
                  <Text className="text-yellow-400 mr-1">★</Text>
                  <Text className="text-white font-semibold">{show.voteAverage.toFixed(1)}</Text>
                  <Text className="text-zinc-500 ml-1">/10</Text>
                </View>
              )}
            </View>
          </View>

          {/* Play next button */}
          {nextEpisode && (
            <View className="mt-6">
              <Button
                variant="primary"
                size="lg"
                onPress={handlePlayNext}
                loading={createSession.isPending}
                fullWidth
              >
                ▶ Play S{nextEpisode.seasonNumber}E{nextEpisode.episodeNumber}
                {nextEpisode.title ? ` - ${nextEpisode.title}` : ''}
              </Button>
            </View>
          )}

          {/* Overview */}
          {show.overview && (
            <View className="mt-6">
              <Text className="text-lg font-semibold text-white mb-2">Overview</Text>
              <Text className="text-zinc-300 leading-6">{show.overview}</Text>
            </View>
          )}

          {/* Genres */}
          {show.genres && show.genres.length > 0 && (
            <View className="mt-6">
              <View className="flex-row flex-wrap">
                {show.genres.map((genre: string) => (
                  <Badge key={genre} variant="secondary" size="md" className="mr-2 mb-2">
                    {genre}
                  </Badge>
                ))}
              </View>
            </View>
          )}

          {/* Season selector */}
          {show.seasons && show.seasons.length > 0 && (
            <View className="mt-6">
              <Text className="text-lg font-semibold text-white mb-3">Seasons</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {show.seasons.map((s: Season) => (
                  <Pressable
                    key={s.id}
                    className={`px-4 py-2 rounded-lg mr-2 ${
                      selectedSeason === s.seasonNumber ? 'bg-primary' : 'bg-zinc-800'
                    }`}
                    onPress={() => setSelectedSeason(s.seasonNumber)}
                  >
                    <Text className={selectedSeason === s.seasonNumber ? 'text-white' : 'text-zinc-400'}>
                      {s.name || `Season ${s.seasonNumber}`}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Episodes */}
          <View className="mt-6">
            <Text className="text-lg font-semibold text-white mb-3">
              Episodes
              {seasonQuery.isLoading && ' (Loading...)'}
            </Text>

            {seasonQuery.isLoading ? (
              <ActivityIndicator color="#6366f1" />
            ) : season?.episodes && season.episodes.length > 0 ? (
              <View className="space-y-3">
                {season.episodes.map((episode: Episode) => (
                  <EpisodeCard
                    key={episode.id}
                    stillUrl={episode.stillPath ? `${IMAGE_BASE_URL}/w300${episode.stillPath}` : undefined}
                    episodeNumber={episode.episodeNumber}
                    seasonNumber={episode.seasonNumber}
                    title={episode.title}
                    overview={episode.overview}
                    runtime={episode.runtime}
                    progress={episode.watchProgress?.percentage}
                    isWatched={episode.watchProgress?.isWatched}
                    onPress={() => handlePlayEpisode(episode)}
                    className="mb-3"
                  />
                ))}
              </View>
            ) : (
              <Text className="text-zinc-500">No episodes found for this season.</Text>
            )}
          </View>

          {/* Footer spacer */}
          <View className="h-20" />
        </View>
      </ScrollView>
    </>
  );
}


