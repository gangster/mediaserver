/**
 * Web-optimized HeroBanner component
 *
 * Wraps @mediaserver/ui HeroBanner with web-specific features:
 * - Responsive height variants (50vh mobile → 70vh desktop)
 * - Responsive text sizing
 * - Button stacking on mobile
 * - Overview hidden on mobile
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Link } from 'expo-router';

/** Media item for banner */
export interface BannerItem {
  id: string;
  title: string;
  overview?: string | null;
  backdropPath?: string | null;
  voteAverage?: number | null;
  year?: number | null;
  type: 'movie' | 'show';
}

export interface WebHeroBannerProps {
  /** Featured item to display */
  item: BannerItem;
  /** Called when play button is clicked */
  onPlay?: (item: BannerItem) => void;
  /** Called when more info button is clicked */
  onMoreInfo?: (item: BannerItem) => void;
  /** Height variant */
  variant?: 'full' | 'compact';
  /** Image base URL */
  imageBaseUrl?: string;
}

/**
 * Get backdrop image URL
 */
function getBackdropUrl(item: BannerItem, baseUrl: string): string {
  if (!item.backdropPath) return '';
  if (item.backdropPath.startsWith('http')) {
    return item.backdropPath;
  }
  const endpoint = item.type === 'movie' ? 'movies' : 'shows';
  return `${baseUrl}/${endpoint}/${item.id}/backdrop?size=large`;
}

/**
 * Rating display
 */
function Rating({ value }: { value: number }) {
  return (
    <View className="flex flex-row items-center gap-1">
      <svg
        className="w-5 h-5 text-yellow-400"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <Text className="text-white font-medium">{value.toFixed(1)}</Text>
    </View>
  );
}

/**
 * Web-optimized HeroBanner component
 */
export function WebHeroBanner({
  item,
  onPlay,
  onMoreInfo,
  variant = 'full',
  imageBaseUrl = 'http://localhost:3000/api/images',
}: WebHeroBannerProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const backdropUrl = getBackdropUrl(item, imageBaseUrl);
  const hasBackdrop = !!item.backdropPath && !imageError;

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Responsive height classes
  const heightClass =
    variant === 'full'
      ? 'h-[50vh] sm:h-[60vh] lg:h-[70vh] min-h-[350px] sm:min-h-[400px] lg:min-h-[500px]'
      : 'h-[40vh] sm:h-[45vh] lg:h-[50vh] min-h-[280px] sm:min-h-[300px] lg:min-h-[350px]';

  const linkTo = item.type === 'movie' ? `/movies/${item.id}` : `/tv/${item.id}`;

  return (
    <View className={`relative ${heightClass} overflow-hidden`}>
      {/* Background image */}
      <View className="absolute inset-0">
        {/* Loading state */}
        {!imageLoaded && hasBackdrop && (
          <View className="absolute inset-0 bg-zinc-900 animate-pulse" />
        )}

        {/* Placeholder gradient for missing backdrop */}
        {!hasBackdrop && (
          <View className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
        )}

        {/* Actual backdrop */}
        {hasBackdrop && (
          <Image
            source={{ uri: backdropUrl }}
            className={`w-full h-full ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            resizeMode="cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {/* Overlay gradients */}
        <View className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
        <View className="absolute inset-0 bg-gradient-to-r from-zinc-900/80 via-zinc-900/40 to-transparent" />
      </View>

      {/* Content */}
      <View className="absolute inset-0 flex justify-end">
        <View className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12 lg:pb-16 gap-2 sm:gap-3 lg:gap-4">
          {/* Title - responsive text sizing */}
          <Text
            className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white"
            numberOfLines={2}
            // @ts-expect-error - web-only text shadow
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            {item.title}
          </Text>

          {/* Metadata */}
          <View className="flex flex-row flex-wrap items-center gap-2 sm:gap-4">
            {item.voteAverage != null && item.voteAverage > 0 && (
              <Rating value={item.voteAverage} />
            )}
            {item.year && (
              <Text className="text-xs sm:text-sm text-zinc-300">{item.year}</Text>
            )}
          </View>

          {/* Overview - hidden on mobile */}
          {item.overview && (
            <Text
              className="hidden sm:flex text-sm sm:text-base lg:text-lg text-zinc-200 max-w-2xl"
              numberOfLines={3}
            >
              {item.overview}
            </Text>
          )}

          {/* Action buttons - stack on mobile */}
          <View className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1 sm:pt-2">
            <Pressable
              onPress={() => (onPlay ? onPlay(item) : null)}
              className="flex flex-row items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white rounded-lg active:bg-zinc-200 touch-target"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6 text-black"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <Text className="text-black font-semibold">Play</Text>
            </Pressable>

            {onMoreInfo ? (
              <Pressable
                onPress={() => onMoreInfo(item)}
                className="flex flex-row items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-600/80 rounded-lg active:bg-zinc-600 touch-target"
              >
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <Text className="hidden sm:flex text-white font-semibold">
                  More Info
                </Text>
                <Text className="flex sm:hidden text-white font-semibold">Info</Text>
              </Pressable>
            ) : (
              <Link href={linkTo as '/movies/[id]'} asChild>
                <Pressable className="flex flex-row items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-600/80 rounded-lg active:bg-zinc-600 touch-target">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <Text className="hidden sm:flex text-white font-semibold">
                    More Info
                  </Text>
                  <Text className="flex sm:hidden text-white font-semibold">Info</Text>
                </Pressable>
              </Link>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton loader for WebHeroBanner
 */
export function WebHeroBannerSkeleton({
  variant = 'full',
}: {
  variant?: 'full' | 'compact';
}) {
  const heightClass =
    variant === 'full'
      ? 'h-[50vh] sm:h-[60vh] lg:h-[70vh] min-h-[350px] sm:min-h-[400px] lg:min-h-[500px]'
      : 'h-[40vh] sm:h-[45vh] lg:h-[50vh] min-h-[280px] sm:min-h-[300px] lg:min-h-[350px]';

  return (
    <View className={`relative ${heightClass} bg-zinc-900`}>
      {/* Gradient overlay */}
      <View className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-zinc-800" />

      {/* Content skeleton */}
      <View className="absolute inset-0 flex justify-end">
        <View className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12 lg:pb-16 gap-2 sm:gap-3 lg:gap-4">
          {/* Title skeleton */}
          <View className="h-8 sm:h-10 lg:h-12 bg-zinc-800 rounded-lg animate-pulse w-2/3" />

          {/* Metadata skeleton */}
          <View className="flex flex-row gap-2 sm:gap-4">
            <View className="h-4 sm:h-5 w-12 sm:w-16 bg-zinc-800 rounded animate-pulse" />
            <View className="h-4 sm:h-5 w-10 sm:w-12 bg-zinc-800 rounded animate-pulse" />
          </View>

          {/* Overview skeleton - hidden on mobile */}
          <View className="hidden sm:flex flex-col gap-2">
            <View className="h-4 bg-zinc-800 rounded animate-pulse w-full" />
            <View className="h-4 bg-zinc-800 rounded animate-pulse w-4/5" />
            <View className="h-4 bg-zinc-800 rounded animate-pulse w-2/3 hidden lg:flex" />
          </View>

          {/* Button skeleton */}
          <View className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1 sm:pt-2">
            <View className="h-10 sm:h-12 w-full sm:w-24 bg-zinc-800 rounded-lg animate-pulse" />
            <View className="h-10 sm:h-12 w-full sm:w-28 bg-zinc-700 rounded-lg animate-pulse" />
          </View>
        </View>
      </View>
    </View>
  );
}

export default WebHeroBanner;
