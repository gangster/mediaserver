/**
 * Episode Watch Page
 *
 * Full-screen video player for watching TV episodes
 * with next episode auto-play support.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, StatusBar } from 'react-native';
import { useEpisode } from '@mediaserver/api-client';
import { VideoPlayer, type NextEpisode } from '../../../src/components/player';
import { getMediaImageUrl } from '../../../src/lib/config';

export default function EpisodeWatchPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: episode } = useEpisode(id ?? '');

  /**
   * Navigate back to show details
   */
  const handleBack = () => {
    router.back();
  };

  /**
   * Handle next episode navigation
   */
  const handleNextEpisode = () => {
    if (episode?.nextEpisodeId) {
      // Replace current watch page with next episode
      router.replace(`/watch/tv/${episode.nextEpisodeId}` as any);
    } else {
      // No next episode, go back to show details
      router.replace(`/tv/${episode?.showId}` as any);
    }
  };

  // Build next episode info for the player
  const nextEpisodeInfo: NextEpisode | null = episode?.nextEpisode
    ? {
        episodeId: episode.nextEpisode.id,
        showId: episode.showId ?? '',
        seasonNumber: episode.nextEpisode.seasonNumber,
        episodeNumber: episode.nextEpisode.episodeNumber,
        title: episode.nextEpisode.title,
        thumbnailUrl: episode.nextEpisode.stillPath
          ? getMediaImageUrl('episodes', episode.nextEpisode.id, 'still', 'medium')
          : undefined,
        duration: episode.nextEpisode.duration ?? 0,
      }
    : null;

  // Get still/backdrop URL for loading placeholder
  const posterUrl = episode?.stillPath
    ? getMediaImageUrl('episodes', id ?? '', 'still', 'large')
    : undefined;

  // Build title: "S1E5 - Episode Title"
  const episodeTitle = episode
    ? `S${episode.seasonNumber}E${episode.episodeNumber} - ${episode.title}`
    : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <StatusBar hidden />
      <VideoPlayer
        mediaType="episode"
        mediaId={id ?? ''}
        title={episodeTitle}
        posterUrl={posterUrl}
        nextEpisode={nextEpisodeInfo}
        autoPlay
        onBack={handleBack}
        onNextEpisode={handleNextEpisode}
      />
    </View>
  );
}
