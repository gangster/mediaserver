/**
 * Media row component - horizontal scrolling Netflix-style row.
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  type ScrollViewProps,
  Animated,
} from 'react-native';
import { cn } from '../utils/cn.js';
import { isTV } from '../utils/platform.js';
import { MediaCard, EpisodeCard, type MediaCardSize } from './MediaCard.js';
import { SkeletonMediaCard } from './Skeleton.js';

/** Media item type for row */
export interface MediaRowItem {
  id: string;
  title: string;
  posterPath?: string | null;
  stillPath?: string | null;
  subtitle?: string;
  year?: number | null;
  progress?: number;
  isWatched?: boolean;
  rating?: number | null;
  // Episode-specific
  episodeNumber?: number;
  seasonNumber?: number;
  overview?: string | null;
  runtime?: number | null;
}

/** Media row props */
export interface MediaRowProps<T extends MediaRowItem> {
  /** Section title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Data items */
  data: T[];
  /** Card size */
  cardSize?: MediaCardSize;
  /** Display as episode cards */
  episodeMode?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Number of skeleton items when loading */
  skeletonCount?: number;
  /** On item press callback */
  onItemPress?: (item: T) => void;
  /** On "See All" press callback */
  onSeeAllPress?: () => void;
  /** Show "See All" button */
  showSeeAll?: boolean;
  /** Custom class name */
  className?: string;
  /** Header class name */
  headerClassName?: string;
  /** Image base URL */
  imageBaseUrl?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Custom render item function */
  renderCustomItem?: (item: T, index: number) => React.ReactNode;
}

/**
 * Media row component - horizontal scrolling list.
 *
 * @example
 * <MediaRow
 *   title="Continue Watching"
 *   data={continueWatching}
 *   onItemPress={(item) => navigate(`/movie/${item.id}`)}
 *   onSeeAllPress={() => navigate('/continue-watching')}
 * />
 */
export function MediaRow<T extends MediaRowItem>({
  title,
  subtitle,
  data,
  cardSize = 'md',
  episodeMode = false,
  loading = false,
  skeletonCount = 6,
  onItemPress,
  onSeeAllPress,
  showSeeAll = true,
  className,
  headerClassName,
  imageBaseUrl = 'https://image.tmdb.org/t/p/w185',
  emptyMessage = 'No items to display',
  renderCustomItem,
}: MediaRowProps<T>) {
  const tv = isTV();
  const scrollViewRef = useRef<ScrollView>(null);

  // TV: Track focused index for scroll-into-view
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  const renderItem = (item: T, index: number) => {
    if (renderCustomItem) {
      return renderCustomItem(item, index);
    }

    if (episodeMode && item.episodeNumber !== undefined) {
      const stillUrl = item.stillPath
        ? `${imageBaseUrl.replace('w185', 'w300')}${item.stillPath}`
        : null;

      return (
        <EpisodeCard
          key={item.id}
          stillUrl={stillUrl}
          episodeNumber={item.episodeNumber}
          seasonNumber={item.seasonNumber}
          title={item.title}
          overview={item.overview}
          runtime={item.runtime}
          progress={item.progress}
          isWatched={item.isWatched}
          onPress={() => onItemPress?.(item)}
          className="mr-4"
          focused={tv && focusedIndex === index}
        />
      );
    }

    const posterUrl = item.posterPath
      ? `${imageBaseUrl}${item.posterPath}`
      : null;

    const itemSubtitle = item.subtitle ?? (item.year ? String(item.year) : undefined);

    return (
      <MediaCard
        key={item.id}
        posterUrl={posterUrl}
        title={item.title}
        subtitle={itemSubtitle}
        progress={item.progress}
        isWatched={item.isWatched}
        rating={item.rating ?? undefined}
        size={cardSize}
        onPress={() => onItemPress?.(item)}
        className="mr-4"
        focused={tv && focusedIndex === index}
      />
    );
  };

  // Skeleton loading state
  const renderSkeleton = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <View key={i} className="mr-4">
          <SkeletonMediaCard />
        </View>
      ))}
    </ScrollView>
  );

  // Empty state
  const renderEmpty = () => (
    <View className="px-4">
      <View className="bg-zinc-900 rounded-xl p-8 items-center justify-center">
        <Text className="text-zinc-500">{emptyMessage}</Text>
      </View>
    </View>
  );

  return (
    <View className={cn('mb-8', className)}>
      {/* Header */}
      <View
        className={cn(
          'flex-row justify-between items-center px-4 mb-4',
          headerClassName
        )}
      >
        <View>
          <Text className="text-xl font-semibold text-white">{title}</Text>
          {subtitle && (
            <Text className="text-zinc-500 text-sm mt-0.5">{subtitle}</Text>
          )}
        </View>

        {showSeeAll && onSeeAllPress && data.length > 0 && (
          <Pressable
            onPress={onSeeAllPress}
            className="active:opacity-70"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text className="text-primary font-medium">See All</Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      {loading ? (
        renderSkeleton()
      ) : data.length === 0 ? (
        renderEmpty()
      ) : (
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          snapToInterval={episodeMode ? 184 : cardSize === 'sm' ? 108 : cardSize === 'lg' ? 201 : 144}
          decelerationRate="fast"
        >
          {data.map((item, index) => renderItem(item, index))}
        </ScrollView>
      )}
    </View>
  );
}

/** Hero banner for featured content */
export interface HeroBannerProps {
  /** Backdrop image URL */
  backdropUrl?: string | null;
  /** Logo image URL */
  logoUrl?: string | null;
  /** Title */
  title: string;
  /** Tagline or description */
  tagline?: string;
  /** Year */
  year?: number | null;
  /** Rating */
  rating?: number | null;
  /** Runtime in minutes */
  runtime?: number | null;
  /** Genres */
  genres?: string[];
  /** On play press */
  onPlayPress?: () => void;
  /** On info press */
  onInfoPress?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * Hero banner component for featured content.
 */
export function HeroBanner({
  backdropUrl,
  logoUrl,
  title,
  tagline,
  year,
  rating,
  runtime,
  genres,
  onPlayPress,
  onInfoPress,
  className,
}: HeroBannerProps) {
  return (
    <View className={cn('relative h-96 overflow-hidden', className)}>
      {/* Backdrop */}
      {backdropUrl && (
        <Animated.Image
          source={{ uri: backdropUrl }}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />
      )}

      {/* Gradient overlay */}
      <View
        className="absolute inset-0"
        style={{
          backgroundColor: 'transparent',
          // backgroundImage: 'linear-gradient(to top, #0a0a0f 0%, transparent 50%, transparent 100%)',
        }}
      >
        <View className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent" />
      </View>

      {/* Content */}
      <View className="absolute bottom-0 left-0 right-0 p-6">
        {/* Logo or title */}
        {logoUrl ? (
          <Animated.Image
            source={{ uri: logoUrl }}
            className="h-16 w-48"
            resizeMode="contain"
          />
        ) : (
          <Text className="text-3xl font-bold text-white">{title}</Text>
        )}

        {/* Metadata row */}
        <View className="flex-row items-center mt-2 space-x-3">
          {year && <Text className="text-zinc-400">{year}</Text>}
          {rating && (
            <View className="flex-row items-center">
              <Text className="text-yellow-400">★</Text>
              <Text className="text-zinc-400 ml-1">{rating.toFixed(1)}</Text>
            </View>
          )}
          {runtime && <Text className="text-zinc-400">{runtime} min</Text>}
        </View>

        {/* Genres */}
        {genres && genres.length > 0 && (
          <Text className="text-zinc-500 text-sm mt-1">
            {genres.slice(0, 3).join(' • ')}
          </Text>
        )}

        {/* Tagline */}
        {tagline && (
          <Text className="text-zinc-300 mt-2" numberOfLines={2}>
            {tagline}
          </Text>
        )}

        {/* Action buttons */}
        <View className="flex-row mt-4 space-x-3">
          {onPlayPress && (
            <Pressable
              className="flex-row items-center bg-white px-6 py-3 rounded-lg active:bg-zinc-200"
              onPress={onPlayPress}
            >
              <Text className="text-black font-semibold">▶ Play</Text>
            </Pressable>
          )}
          {onInfoPress && (
            <Pressable
              className="flex-row items-center bg-zinc-800 px-6 py-3 rounded-lg active:bg-zinc-700"
              onPress={onInfoPress}
            >
              <Text className="text-white font-semibold">ℹ More Info</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export default MediaRow;

