/**
 * Movie Watch Page
 *
 * Full-screen video player for watching movies.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, StatusBar } from 'react-native';
import { useMovie } from '@mediaserver/api-client';
import { VideoPlayer } from '../../../src/components/player';
import { getMediaImageUrl } from '../../../src/lib/config';

export default function MovieWatchPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: movie } = useMovie(id ?? '');

  /**
   * Navigate back to movie details
   */
  const handleBack = () => {
    router.back();
  };

  /**
   * Handle playback ended
   */
  const handleEnded = () => {
    // Navigate back to movie details when movie ends
    router.replace(`/movies/${id}` as any);
  };

  // Get poster URL for loading placeholder
  const posterUrl = movie?.posterPath
    ? getMediaImageUrl('movies', id ?? '', 'backdrop', 'large')
    : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <StatusBar hidden />
      <VideoPlayer
        mediaType="movie"
        mediaId={id ?? ''}
        title={movie?.title}
        posterUrl={posterUrl}
        autoPlay
        onBack={handleBack}
        onEnded={handleEnded}
      />
    </View>
  );
}
