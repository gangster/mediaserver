/**
 * Movie Detail Page
 *
 * Displays detailed information about a specific movie,
 * matching the forreel design with hero backdrop, ratings,
 * and technical details.
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Image, Pressable, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../src/components/layout';
import { useMovie, useMovieFileStats, useMovieCredits, useRatingSources, type MetadataProvider } from '@mediaserver/api-client';
import { useAuth } from '../../src/hooks/useAuth';
import { MultiRating, LegacyRating, TechnicalDetails, MetadataSourceSelector, RefreshMetadataButton, CastSection, type RatingData, type ProviderMetadataResult } from '../../src/components/media';
import { getMediaImageUrl, getLogoUrl } from '../../src/lib/config';

/**
 * Format runtime for display (e.g., 117 -> "1h 57m")
 */
function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

/**
 * Genre tag component
 */
function GenreTag({ genre }: { genre: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(39, 39, 42, 0.8)',
        borderRadius: 999,
      }}
    >
      <Text style={{ fontSize: 14, color: '#d4d4d8' }}>{genre}</Text>
    </View>
  );
}

/**
 * Loading skeleton
 */
function MovieDetailSkeleton() {
  const { height } = useWindowDimensions();

  return (
    <Layout>
      <View style={{ flex: 1, backgroundColor: '#18181b' }}>
        {/* Hero skeleton */}
        <View
          style={{
            height: height * 0.6,
            backgroundColor: '#27272a',
          }}
        />

        {/* Content skeleton */}
        <View style={{ paddingHorizontal: 32, marginTop: -128 }}>
          <View style={{ flexDirection: 'row', gap: 32 }}>
            {/* Poster skeleton */}
            <View
              style={{
                width: 256,
                height: 384,
                backgroundColor: '#3f3f46',
                borderRadius: 12,
              }}
            />
            {/* Info skeleton */}
            <View style={{ flex: 1, gap: 16 }}>
              <View style={{ width: '60%', height: 40, backgroundColor: '#3f3f46', borderRadius: 8 }} />
              <View style={{ width: '40%', height: 24, backgroundColor: '#3f3f46', borderRadius: 8 }} />
              <View style={{ width: '100%', height: 16, backgroundColor: '#3f3f46', borderRadius: 8 }} />
              <View style={{ width: '80%', height: 16, backgroundColor: '#3f3f46', borderRadius: 8 }} />
            </View>
          </View>
        </View>
      </View>
    </Layout>
  );
}

/**
 * Error state
 */
function MovieDetailError({ message }: { message: string }) {
  return (
    <Layout>
      <View
        style={{
          flex: 1,
          backgroundColor: '#18181b',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <Ionicons name="alert-circle" size={64} color="#ef4444" style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 20, fontWeight: '600', color: '#ffffff', marginBottom: 8 }}>
          Movie Not Found
        </Text>
        <Text style={{ fontSize: 16, color: '#a1a1aa', textAlign: 'center', marginBottom: 24 }}>
          {message}
        </Text>
        <Link href="/movies" asChild>
          <Pressable
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: '#10b981',
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Back to Movies</Text>
          </Pressable>
        </Link>
      </View>
    </Layout>
  );
}

export default function MovieDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 768;

  const { data: movie, isLoading, error } = useMovie(id ?? '');
  const { data: fileStats, isLoading: fileStatsLoading } = useMovieFileStats(id ?? '', !!id && !!movie);
  const { data: credits, isLoading: creditsLoading } = useMovieCredits(id ?? '', { maxCast: 20, maxCrew: 15 }, !!id);
  const { data: ratingSourcesConfig } = useRatingSources();
  const { isAdmin } = useAuth();

  // Filter ratings to only show enabled sources
  const filteredRatings = useMemo(() => {
    if (!movie?.ratings || !ratingSourcesConfig?.enabledSources) {
      return movie?.ratings ?? [];
    }
    const enabledSources = new Set(ratingSourcesConfig.enabledSources);
    return movie.ratings.filter((r: { source: string }) => enabledSources.has(r.source));
  }, [movie?.ratings, ratingSourcesConfig?.enabledSources]);

  // Provider metadata state - allows switching between metadata sources
  const [activeProvider, setActiveProvider] = useState<MetadataProvider>('tmdb');
  const [providerMetadata, setProviderMetadata] = useState<ProviderMetadataResult | null>(null);

  // Handle metadata change from provider selector
  const handleMetadataChange = useCallback((metadata: ProviderMetadataResult | null, provider: MetadataProvider) => {
    setProviderMetadata(metadata);
    setActiveProvider(provider);
  }, []);

  // Use provider metadata if available, otherwise fall back to movie data
  const displayTitle = providerMetadata?.title ?? movie?.title;
  const displayOverview = providerMetadata?.overview ?? movie?.overview;
  const displayTagline = providerMetadata?.tagline ?? movie?.tagline;
  const displayRuntime = providerMetadata?.runtime ?? movie?.runtime;
  const displayGenres = providerMetadata?.genres ?? movie?.genres;
  const displayStudios = providerMetadata?.productionCompanies ?? [];

  // Build technical details from fileStats API or fall back to movie data
  const technicalDetails = useMemo(() => {
    if (!movie) return null;

    // If we have detailed file stats, use them
    if (fileStats) {
      const videoStream = fileStats.videoStreams[0];
      const audioStream = fileStats.audioStreams[0];
      const subtitleLanguages = fileStats.subtitleStreams
        ?.map((s: { language?: string }) => s.language)
        .filter((l?: string): l is string => !!l) ?? [];

      return {
        videoCodec: videoStream?.codec ?? movie.videoCodec ?? null,
        audioCodec: audioStream?.codec ?? movie.audioCodec ?? null,
        resolution: videoStream?.resolution ?? movie.resolution ?? null,
        runtime: movie.runtime ?? null,
        duration: fileStats.duration ?? movie.duration ?? null,
        frameRate: videoStream?.frameRate ?? null,
        channels: audioStream?.channelLayout ?? (audioStream?.channels ? `${audioStream.channels}.0` : null),
        hdr: videoStream?.hdr ?? null,
        container: fileStats.container ?? null,
        fileName: fileStats.fileName ?? null,
        filePath: fileStats.filePath ?? null,
        fileSize: fileStats.fileSize ?? null,
        bitRate: fileStats.bitRate ?? null,
        tmdbId: movie.tmdbId ?? null,
        imdbId: movie.imdbId ?? null,
        subtitleLanguages,
      };
    }

    // Fallback to parsing movie data directly
    const streams = movie.mediaStreams ?? [];
    const videoStream = streams.find((s: { codec_type?: string }) => s.codec_type === 'video');
    const audioStream = streams.find((s: { codec_type?: string }) => s.codec_type === 'audio');

    const fileName = movie.filePath?.split('/').pop() ?? null;
    const container = fileName?.split('.').pop()?.toUpperCase() ?? null;

    const subtitleStreams = streams.filter((s: { codec_type?: string }) => s.codec_type === 'subtitle');
    const subtitleLanguages = subtitleStreams
      .map((s: { tags?: { language?: string } }) => s.tags?.language)
      .filter((l: string | undefined): l is string => !!l);

    // Safely parse frame rate
    let frameRate: number | null = null;
    if (videoStream?.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split('/');
      if (parts.length === 2) {
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]);
        if (den > 0) frameRate = num / den;
      }
    }

    return {
      videoCodec: movie.videoCodec ?? videoStream?.codec_name ?? null,
      audioCodec: movie.audioCodec ?? audioStream?.codec_name ?? null,
      resolution: movie.resolution ?? (videoStream?.width && videoStream?.height ? `${videoStream.width}x${videoStream.height}` : null),
      runtime: movie.runtime ?? null,
      duration: movie.duration ?? null,
      frameRate,
      channels: audioStream?.channels ? `${audioStream.channels}.${audioStream.channels > 6 ? '1' : '0'}` : null,
      hdr: videoStream?.color_primaries === 'bt2020' ? 'HDR10' : null,
      container,
      fileName,
      filePath: movie.filePath ?? null,
      fileSize: null,
      bitRate: null,
      tmdbId: movie.tmdbId ?? null,
      imdbId: movie.imdbId ?? null,
      subtitleLanguages,
    };
  }, [movie, fileStats]);

  if (isLoading) {
    return <MovieDetailSkeleton />;
  }

  if (error || !movie) {
    return <MovieDetailError message={error?.message ?? 'Movie not found'} />;
  }

  const backdropUrl = movie.backdropPath
    ? getMediaImageUrl('movies', movie.id, 'backdrop', 'large')
    : null;

  const posterUrl = movie.posterPath
    ? getMediaImageUrl('movies', movie.id, 'poster', 'medium')
    : null;

  return (
    <Layout>
      <ScrollView style={{ flex: 1, backgroundColor: '#18181b' }}>
        {/* Hero Backdrop */}
        <View style={{ position: 'relative', height: height * 0.6, minHeight: 400 }}>
          {backdropUrl ? (
            <Image
              source={{ uri: backdropUrl }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
              }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#27272a',
              }}
            />
          )}

          {/* Gradient overlays */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              // @ts-expect-error - linear-gradient is web-only CSS
              background: 'linear-gradient(to top, #18181b 0%, rgba(24, 24, 27, 0.6) 50%, transparent 100%)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              // @ts-expect-error - linear-gradient is web-only CSS
              background: 'linear-gradient(to right, rgba(24, 24, 27, 0.8) 0%, transparent 50%)',
            }}
          />

          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            style={{
              position: 'absolute',
              top: 24,
              left: 24,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </Pressable>
        </View>

        {/* Content */}
        <View style={{ marginTop: -192, paddingHorizontal: isDesktop ? 48 : 24, paddingBottom: 48, zIndex: 10 }}>
          <View style={{ maxWidth: 1200, marginHorizontal: 'auto', width: '100%' }}>
            {/* Main info section */}
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 32 }}>
              {/* Poster (desktop only) */}
              {isDesktop && (
                <View style={{ flexShrink: 0 }}>
                  {posterUrl ? (
                    <Image
                      source={{ uri: posterUrl }}
                      style={{
                        width: 256,
                        height: 384,
                        borderRadius: 12,
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 256,
                        height: 384,
                        borderRadius: 12,
                        backgroundColor: '#27272a',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 64, color: '#52525b' }}>{movie.title[0]}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Info */}
              <View style={{ flex: 1, gap: 24 }}>
                {/* Title */}
                <View>
                  <Text style={{ fontSize: isDesktop ? 48 : 32, fontWeight: '700', color: '#ffffff', marginBottom: 8 }}>
                    {displayTitle}
                  </Text>
                  {displayTagline && (
                    <Text style={{ fontSize: 18, color: '#a1a1aa', fontStyle: 'italic' }}>
                      {displayTagline}
                    </Text>
                  )}
                </View>

                {/* Ratings row */}
                {(filteredRatings && filteredRatings.length > 0) || (movie.voteAverage != null && movie.voteAverage > 0) ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    {filteredRatings && filteredRatings.length > 0 ? (
                      <MultiRating ratings={filteredRatings as RatingData[]} />
                    ) : movie.voteAverage != null && movie.voteAverage > 0 ? (
                      <LegacyRating value={movie.voteAverage} />
                    ) : null}
                  </View>
                ) : null}

                {/* Metadata row: year, runtime, content rating */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                  {displayRuntime && (
                    <Text style={{ fontSize: 16, color: '#d4d4d8' }}>{formatRuntime(displayRuntime)}</Text>
                  )}
                  {movie.year && (
                    <>
                      <Text style={{ fontSize: 16, color: '#52525b' }}>•</Text>
                      <Text style={{ fontSize: 16, color: '#d4d4d8' }}>{movie.year}</Text>
                    </>
                  )}
                  {movie.contentRating && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderWidth: 1,
                        borderColor: '#52525b',
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: '#d4d4d8' }}>{movie.contentRating}</Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                  {/* Play button */}
                  <Pressable
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 32,
                      paddingVertical: 16,
                      backgroundColor: '#ffffff',
                      borderRadius: 8,
                    }}
                  >
                    <Ionicons name="play" size={24} color="#000000" />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#000000' }}>Play</Text>
                  </Pressable>

                  {/* Refresh Metadata (admin only) */}
                  {isAdmin && id && (
                    <RefreshMetadataButton type="movie" itemId={id} />
                  )}
                </View>

                {/* Genres */}
                {displayGenres && displayGenres.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {displayGenres.map((genre: string) => (
                      <GenreTag key={genre} genre={genre} />
                    ))}
                  </View>
                )}

                {/* Overview */}
                {displayOverview && (
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 8 }}>
                      Overview
                    </Text>
                    <Text style={{ fontSize: 16, color: '#d4d4d8', lineHeight: 24 }}>
                      {displayOverview}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Studios */}
            {displayStudios && displayStudios.length > 0 && (
              <View style={{ marginTop: 48 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 16 }}>
                  Studios
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                  {displayStudios.slice(0, 4).map((studio) => (
                    <View
                      key={studio.id}
                      style={{
                        backgroundColor: 'rgba(39, 39, 42, 0.5)',
                        borderRadius: 12,
                        padding: 16,
                        minWidth: 140,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {studio.logoPath ? (
                        <Image
                          source={{ uri: getLogoUrl(studio.logoPath!, 'medium') }}
                          style={{
                            height: 32,
                            width: 100,
                            filter: 'brightness(0) invert(1)',
                          } as any}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '600', textAlign: 'center' }}>
                          {studio.name}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Cast & Crew */}
            <CastSection
              cast={credits?.cast?.map((c) => ({
                id: c.id,
                name: c.name,
                character: c.character,
                profilePath: c.profilePath,
                order: c.order,
              })) ?? []}
              crew={credits?.crew?.map((c) => ({
                id: c.id,
                name: c.name,
                job: c.job,
                department: c.department,
                profilePath: c.profilePath,
              })) ?? []}
              isLoading={creditsLoading}
              layout="separate"
            />

            {/* Metadata Source Selector */}
            <View style={{ marginTop: 48 }}>
              <MetadataSourceSelector
                type="movie"
                itemId={id ?? ''}
                currentProvider={activeProvider}
                onMetadataChange={handleMetadataChange}
                onProviderChange={setActiveProvider}
              />
            </View>

            {/* Technical Details */}
            {technicalDetails && (
              <View style={{ marginTop: 48 }}>
                <TechnicalDetails
                  videoCodec={technicalDetails.videoCodec}
                  audioCodec={technicalDetails.audioCodec}
                  resolution={technicalDetails.resolution}
                  runtime={technicalDetails.runtime}
                  duration={technicalDetails.duration}
                  frameRate={technicalDetails.frameRate}
                  channels={technicalDetails.channels}
                  hdr={technicalDetails.hdr}
                  container={technicalDetails.container}
                  fileName={technicalDetails.fileName}
                  filePath={technicalDetails.filePath}
                  fileSize={technicalDetails.fileSize}
                  bitRate={technicalDetails.bitRate}
                  tmdbId={technicalDetails.tmdbId}
                  imdbId={technicalDetails.imdbId}
                  subtitleLanguages={technicalDetails.subtitleLanguages}
                  isLoading={fileStatsLoading}
                />
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </Layout>
  );
}
