/**
 * TV Show Detail Page
 *
 * Displays detailed information about a specific TV show,
 * matching the forreel design with hero backdrop, ratings,
 * seasons, episodes, and show info.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Image, Pressable, useWindowDimensions, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../src/components/layout';
import { useShow, useRatingSources, useSeason, useShowCredits, type MetadataProvider } from '@mediaserver/api-client';
import { useAuth } from '../../src/hooks/useAuth';
import { MultiRating, LegacyRating, MetadataSourceSelector, RefreshMetadataButton, CastSection, type RatingData, type ProviderMetadataResult } from '../../src/components/media';
import { getMediaImageUrl, getLogoUrl } from '../../src/lib/config';

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
 * Show stats cards
 */
function ShowStats({
  seasonCount,
  episodeCount,
  status,
  network,
  networkLogoPath,
}: {
  seasonCount: number;
  episodeCount: number;
  status?: string | null;
  network?: string | null;
  networkLogoPath?: string | null;
}) {
  const networkLogoUrl = networkLogoPath
    ? getLogoUrl(networkLogoPath, 'medium')
    : null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      <View style={{ flex: 1, minWidth: 120, backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff' }}>{seasonCount}</Text>
        <Text style={{ fontSize: 14, color: '#a1a1aa' }}>{seasonCount === 1 ? 'Season' : 'Seasons'}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 120, backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff' }}>{episodeCount}</Text>
        <Text style={{ fontSize: 14, color: '#a1a1aa' }}>{episodeCount === 1 ? 'Episode' : 'Episodes'}</Text>
      </View>
      {status && (
        <View style={{ flex: 1, minWidth: 120, backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 16 }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: status === 'Returning Series' ? '#34d399' : status === 'Ended' ? '#a1a1aa' : '#ffffff',
          }}>
            {status === 'Returning Series' ? 'Returning' : status}
          </Text>
          <Text style={{ fontSize: 14, color: '#a1a1aa' }}>Status</Text>
        </View>
      )}
      {network && (
        <View style={{ flex: 1, minWidth: 120, backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 16 }}>
          {networkLogoUrl ? (
            <View style={{ height: 28, justifyContent: 'center', marginBottom: 4 }}>
              <Image
                source={{ uri: networkLogoUrl }}
                style={{
                  height: 24,
                  width: 80,
                  filter: 'brightness(0) invert(1)',
                } as any}
                resizeMode="contain"
              />
            </View>
          ) : (
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }} numberOfLines={1}>{network}</Text>
          )}
          <Text style={{ fontSize: 14, color: '#a1a1aa' }}>Network</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Season selector tabs
 */
function SeasonTabs({
  seasons,
  selectedSeason,
  onSelectSeason,
}: {
  seasons: Array<{ seasonNumber: number; name: string | null; episodeCount: number }>;
  selectedSeason: number;
  onSelectSeason: (season: number) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {seasons.map((season) => (
          <Pressable
            key={season.seasonNumber}
            onPress={() => onSelectSeason(season.seasonNumber)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: selectedSeason === season.seasonNumber ? '#10b981' : 'rgba(39, 39, 42, 0.8)',
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '500' }}>
              {season.name || `Season ${season.seasonNumber}`}
              <Text style={{ opacity: 0.7, fontSize: 12 }}> ({season.episodeCount})</Text>
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * Episode card component with progress tracking
 */
function EpisodeCard({
  episode,
}: {
  episode: {
    id: string;
    episodeNumber: number;
    title: string | null;
    overview: string | null;
    stillPath: string | null;
    runtime: number | null;
    airDate: string | null;
    watchProgress?: {
      percentage: number;
      isWatched: boolean;
    } | null;
  };
}) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  
  const stillUrl = episode.stillPath
    ? getMediaImageUrl('episodes', episode.id, 'still', 'medium')
    : null;

  const hasProgress = episode.watchProgress && episode.watchProgress.percentage > 0;
  const isWatched = episode.watchProgress?.isWatched;

  const handlePress = () => {
    router.push(`/tv/episode/${episode.id}` as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={{
        flexDirection: 'row',
        gap: 16,
        padding: 12,
        borderRadius: 12,
        backgroundColor: isHovered ? 'rgba(39, 39, 42, 0.6)' : 'rgba(39, 39, 42, 0.3)',
        marginBottom: 8,
      }}
    >
      {/* Thumbnail with progress */}
      <View style={{ width: 160, position: 'relative' }}>
        <View style={{ aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden', backgroundColor: '#27272a' }}>
          {stillUrl ? (
            <Image
              source={{ uri: stillUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#27272a' }}>
              <Text style={{ fontSize: 24, color: '#52525b' }}>{episode.episodeNumber}</Text>
            </View>
          )}

          {/* Play overlay - show on hover */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
              opacity: isHovered ? 1 : 0,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="play" size={20} color="#ffffff" style={{ marginLeft: 2 }} />
            </View>
          </View>

          {/* Progress bar */}
          {hasProgress && !isWatched && (
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${episode.watchProgress!.percentage}%`,
                  backgroundColor: '#10b981',
                }}
              />
            </View>
          )}

          {/* Watched checkmark */}
          {isWatched && (
            <View
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#10b981',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark" size={14} color="#ffffff" />
            </View>
          )}
        </View>
      </View>

      {/* Info */}
      <View style={{ flex: 1, paddingVertical: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Text style={{ color: '#71717a', fontSize: 13 }}>E{episode.episodeNumber}</Text>
          {episode.runtime && (
            <>
              <Text style={{ color: '#52525b', fontSize: 13 }}>•</Text>
              <Text style={{ color: '#71717a', fontSize: 13 }}>{episode.runtime}m</Text>
            </>
          )}
          {episode.airDate && (
            <>
              <Text style={{ color: '#52525b', fontSize: 13 }}>•</Text>
              <Text style={{ color: '#71717a', fontSize: 13 }}>
                {new Date(episode.airDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </>
          )}
        </View>
        <Text 
          style={{ 
            color: isHovered ? '#34d399' : '#ffffff', 
            fontWeight: '500', 
            fontSize: 15, 
            marginBottom: 4 
          }} 
          numberOfLines={1}
        >
          {episode.title || `Episode ${episode.episodeNumber}`}
        </Text>
        {episode.overview && (
          <Text style={{ color: '#a1a1aa', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
            {episode.overview}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/**
 * Episode type from API
 */
interface EpisodeData {
  id: string;
  episodeNumber: number;
  title: string | null;
  overview: string | null;
  stillPath: string | null;
  runtime: number | null;
  airDate: string | null;
  watchProgress?: {
    percentage: number;
    isWatched: boolean;
    position?: number;
    duration?: number;
  } | null;
}

/**
 * Episodes list component
 */
function EpisodesList({ showId, seasonNumber }: { showId: string; seasonNumber: number }) {
  const { data: season, isLoading } = useSeason(showId, seasonNumber, !!showId && seasonNumber > 0);

  if (isLoading) {
    return (
      <View style={{ gap: 8 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 16, padding: 12, backgroundColor: 'rgba(39, 39, 42, 0.3)', borderRadius: 12 }}>
            <View style={{ width: 160, aspectRatio: 16 / 9, backgroundColor: '#27272a', borderRadius: 8 }} />
            <View style={{ flex: 1, gap: 8, paddingVertical: 4 }}>
              <View style={{ width: '30%', height: 14, backgroundColor: '#27272a', borderRadius: 4 }} />
              <View style={{ width: '70%', height: 16, backgroundColor: '#27272a', borderRadius: 4 }} />
              <View style={{ width: '100%', height: 14, backgroundColor: '#27272a', borderRadius: 4 }} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (!season || !season.episodes || season.episodes.length === 0) {
    return (
      <View style={{ padding: 24, alignItems: 'center', backgroundColor: 'rgba(39, 39, 42, 0.3)', borderRadius: 12 }}>
        <Ionicons name="film-outline" size={32} color="#52525b" style={{ marginBottom: 8 }} />
        <Text style={{ color: '#a1a1aa' }}>No episodes found for this season</Text>
      </View>
    );
  }

  return (
    <View>
      {season.overview && (
        <View style={{ marginBottom: 16, padding: 16, backgroundColor: 'rgba(39, 39, 42, 0.3)', borderRadius: 12 }}>
          <Text style={{ color: '#a1a1aa', lineHeight: 22 }}>{season.overview}</Text>
        </View>
      )}
      {season.episodes.map((episode: EpisodeData) => (
        <EpisodeCard key={episode.id} episode={episode} />
      ))}
    </View>
  );
}

/**
 * Show info section
 */
function ShowInfo({
  firstAirDate,
  lastAirDate,
  tmdbId,
}: {
  firstAirDate?: string | null;
  lastAirDate?: string | null;
  tmdbId?: number | null;
}) {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const items: Array<{ label: string; value: string; href?: string }> = [];

  if (firstAirDate) {
    items.push({ label: 'First Aired', value: formatDate(firstAirDate) });
  }
  if (lastAirDate) {
    items.push({ label: 'Last Aired', value: formatDate(lastAirDate) });
  }
  if (tmdbId) {
    items.push({
      label: 'TMDb',
      value: `${tmdbId}`,
      href: `https://www.themoviedb.org/tv/${tmdbId}`,
    });
  }

  if (items.length === 0) return null;

  return (
    <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 16 }}>Show Info</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
        {items.map((item) => (
          <View key={item.label} style={{ minWidth: 100 }}>
            <Text style={{ fontSize: 12, color: '#71717a', marginBottom: 4 }}>{item.label}</Text>
            {item.href ? (
              <Pressable onPress={() => Linking.openURL(item.href!)}>
                <Text style={{ fontSize: 14, color: '#10b981', fontWeight: '500' }}>{item.value}</Text>
              </Pressable>
            ) : (
              <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '500' }}>{item.value}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Loading skeleton
 */
function ShowDetailSkeleton() {
  const { height } = useWindowDimensions();

  return (
    <Layout>
      <View style={{ flex: 1, backgroundColor: '#18181b' }}>
        <View style={{ height: height * 0.5, backgroundColor: '#27272a' }} />
        <View style={{ paddingHorizontal: 32, marginTop: -128 }}>
          <View style={{ flexDirection: 'row', gap: 32 }}>
            <View style={{ width: 208, height: 312, backgroundColor: '#3f3f46', borderRadius: 12 }} />
            <View style={{ flex: 1, gap: 16 }}>
              <View style={{ width: '60%', height: 40, backgroundColor: '#3f3f46', borderRadius: 8 }} />
              <View style={{ width: '40%', height: 24, backgroundColor: '#3f3f46', borderRadius: 8 }} />
              <View style={{ width: '100%', height: 16, backgroundColor: '#3f3f46', borderRadius: 8 }} />
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
function ShowDetailError({ message }: { message: string }) {
  return (
    <Layout>
      <View style={{ flex: 1, backgroundColor: '#18181b', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Ionicons name="alert-circle" size={64} color="#ef4444" style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 20, fontWeight: '600', color: '#ffffff', marginBottom: 8 }}>Show Not Found</Text>
        <Text style={{ fontSize: 16, color: '#a1a1aa', textAlign: 'center', marginBottom: 24 }}>{message}</Text>
        <Link href="/tv" asChild>
          <Pressable style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#10b981', borderRadius: 8 }}>
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Back to TV Shows</Text>
          </Pressable>
        </Link>
      </View>
    </Layout>
  );
}

export default function TVShowDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 768;

  const { data: show, isLoading, error } = useShow(id ?? '');
  const { data: credits, isLoading: creditsLoading } = useShowCredits(id ?? '', { maxCast: 20, maxCrew: 15 }, !!id);
  const { data: ratingSourcesConfig } = useRatingSources();
  const { isAdmin } = useAuth();

  // Season selection
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  // Provider metadata state - allows switching between metadata sources
  const [activeProvider, setActiveProvider] = useState<MetadataProvider>('tmdb');
  const [providerMetadata, setProviderMetadata] = useState<ProviderMetadataResult | null>(null);

  // Handle metadata change from provider selector
  const handleMetadataChange = useCallback((metadata: ProviderMetadataResult | null, provider: MetadataProvider) => {
    setProviderMetadata(metadata);
    setActiveProvider(provider);
  }, []);

  // Use provider metadata if available, otherwise fall back to show data
  const displayTitle = providerMetadata?.title ?? show?.title;
  const displayOverview = providerMetadata?.overview ?? show?.overview;
  const displayGenres = providerMetadata?.genres ?? show?.genres;

  // Filter ratings to only show enabled sources
  const filteredRatings = useMemo(() => {
    if (!show?.ratings || !ratingSourcesConfig?.enabledSources) {
      return show?.ratings ?? [];
    }
    const enabledSources = new Set(ratingSourcesConfig.enabledSources);
    return show.ratings.filter((r: { source: string }) => enabledSources.has(r.source));
  }, [show?.ratings, ratingSourcesConfig?.enabledSources]);

  // Set default season when show loads
  useEffect(() => {
    if (show?.seasons && show.seasons.length > 0) {
      const defaultSeason = show.seasons.find((s: { seasonNumber: number }) => s.seasonNumber === 1) || show.seasons[0];
      if (defaultSeason) {
        setSelectedSeason(defaultSeason.seasonNumber);
      }
    }
  }, [show?.seasons]);

  if (isLoading) {
    return <ShowDetailSkeleton />;
  }

  if (error || !show) {
    return <ShowDetailError message={error?.message ?? 'Show not found'} />;
  }

  const backdropUrl = show.backdropPath
    ? getMediaImageUrl('shows', show.id, 'backdrop', 'large')
    : null;

  const posterUrl = show.posterPath
    ? getMediaImageUrl('shows', show.id, 'poster', 'medium')
    : null;

  // Calculate total episode count
  const totalEpisodeCount = show.seasons?.reduce((sum: number, s: { episodeCount?: number }) => sum + (s.episodeCount ?? 0), 0) ?? 0;

  return (
    <Layout>
      <ScrollView style={{ flex: 1, backgroundColor: '#18181b' }}>
        {/* Hero Backdrop */}
        <View style={{ position: 'relative', height: height * 0.5, minHeight: 350 }}>
          {backdropUrl ? (
            <Image
              source={{ uri: backdropUrl }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#27272a' }} />
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
        <View style={{ marginTop: -160, paddingHorizontal: isDesktop ? 48 : 24, paddingBottom: 48, zIndex: 10 }}>
          <View style={{ maxWidth: 1200, marginHorizontal: 'auto', width: '100%' }}>
            {/* Header section */}
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 32, marginBottom: 32 }}>
              {/* Poster (desktop only) */}
              {isDesktop && (
                <View style={{ flexShrink: 0 }}>
                  {posterUrl ? (
                    <Image source={{ uri: posterUrl }} style={{ width: 208, height: 312, borderRadius: 12 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: 208, height: 312, borderRadius: 12, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 48, color: '#52525b' }}>{show.title[0]}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Info */}
              <View style={{ flex: 1, gap: 20 }}>
                {/* Title */}
                <Text style={{ fontSize: isDesktop ? 40 : 28, fontWeight: '700', color: '#ffffff' }}>
                  {displayTitle}
                </Text>

                {/* Ratings row */}
                {(filteredRatings && filteredRatings.length > 0) || (show.voteAverage != null && show.voteAverage > 0) ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    {filteredRatings && filteredRatings.length > 0 ? (
                      <MultiRating ratings={filteredRatings as RatingData[]} />
                    ) : show.voteAverage != null && show.voteAverage > 0 ? (
                      <LegacyRating value={show.voteAverage} />
                    ) : null}
                  </View>
                ) : null}

                {/* Metadata row */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                  {show.year && <Text style={{ fontSize: 16, color: '#d4d4d8' }}>{show.year}</Text>}
                  {show.contentRating && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#52525b', borderRadius: 4 }}>
                      <Text style={{ fontSize: 12, color: '#d4d4d8' }}>{show.contentRating}</Text>
                    </View>
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
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 8 }}>Overview</Text>
                    <Text style={{ fontSize: 15, color: '#d4d4d8', lineHeight: 24 }}>{displayOverview}</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                  <Pressable
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 32, paddingVertical: 16, backgroundColor: '#ffffff', borderRadius: 8 }}
                  >
                    <Ionicons name="play" size={24} color="#000000" />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#000000' }}>Play</Text>
                  </Pressable>

                  {isAdmin && id && (
                    <RefreshMetadataButton type="tvshow" itemId={id} />
                  )}
                </View>
              </View>
            </View>

            {/* Show stats */}
            <View style={{ marginBottom: 32 }}>
              <ShowStats
                seasonCount={show.seasonCount ?? show.seasons?.length ?? 0}
                episodeCount={totalEpisodeCount}
                status={show.status}
                network={show.network}
                networkLogoPath={show.networkLogoPath}
              />
            </View>

            {/* Cast & Crew */}
            <CastSection
              cast={credits?.cast?.map((c: { id: string; name: string; character: string; profilePath?: string | null; order: number }) => ({
                id: c.id,
                name: c.name,
                character: c.character,
                profilePath: c.profilePath,
                order: c.order,
              })) ?? []}
              crew={credits?.crew?.map((c: { id: string; name: string; job: string; department: string; profilePath?: string | null }) => ({
                id: c.id,
                name: c.name,
                job: c.job,
                department: c.department,
                profilePath: c.profilePath,
              })) ?? []}
              isLoading={creditsLoading}
              layout="separate"
            />

            {/* Metadata source selector */}
            <View style={{ marginTop: 32, marginBottom: 32 }}>
              <MetadataSourceSelector
                type="show"
                itemId={id ?? ''}
                currentProvider={activeProvider}
                onMetadataChange={handleMetadataChange}
                onProviderChange={setActiveProvider}
              />
            </View>

            {/* Episodes section */}
            {show.seasons && show.seasons.length > 0 && (
              <View style={{ marginBottom: 32 }}>
                <Text style={{ fontSize: 20, fontWeight: '600', color: '#ffffff', marginBottom: 16 }}>Episodes</Text>

                {/* Season tabs */}
                <SeasonTabs
                  seasons={show.seasons.map((s: { seasonNumber: number; name?: string | null; episodeCount?: number }) => ({
                    seasonNumber: s.seasonNumber,
                    name: s.name ?? null,
                    episodeCount: s.episodeCount ?? 0,
                  }))}
                  selectedSeason={selectedSeason}
                  onSelectSeason={setSelectedSeason}
                />

                {/* Episodes list */}
                <EpisodesList showId={show.id} seasonNumber={selectedSeason} />
              </View>
            )}

            {/* Show info */}
            <ShowInfo
              firstAirDate={show.firstAirDate}
              lastAirDate={show.lastAirDate}
              tmdbId={show.tmdbId}
            />
          </View>
        </View>
      </ScrollView>
    </Layout>
  );
}
