/**
 * Media grid component for displaying collections of media items.
 */

import React from 'react';
import { View, FlatList, type FlatListProps, Dimensions } from 'react-native';
import { cn } from '../utils/cn.js';
import { isTV } from '../utils/platform.js';
import { MediaCard, type MediaCardSize } from './MediaCard.js';
import { SkeletonMediaCard } from './Skeleton.js';

/** Media item type for grid */
export interface MediaGridItem {
  id: string;
  title: string;
  posterPath?: string | null;
  subtitle?: string;
  year?: number | null;
  progress?: number;
  isWatched?: boolean;
  rating?: number | null;
}

/** Media grid props */
export interface MediaGridProps<T extends MediaGridItem>
  extends Omit<FlatListProps<T>, 'renderItem' | 'numColumns' | 'data'> {
  /** Data items */
  data: T[];
  /** Card size */
  cardSize?: MediaCardSize;
  /** Number of columns (auto-calculated if not provided) */
  columns?: number;
  /** Gap between items */
  gap?: number;
  /** Loading state */
  loading?: boolean;
  /** Number of skeleton items when loading */
  skeletonCount?: number;
  /** On item press callback */
  onItemPress?: (item: T) => void;
  /** Custom class name */
  className?: string;
  /** Image base URL (e.g., TMDb image URL) */
  imageBaseUrl?: string;
  /** Custom render item function */
  renderCustomItem?: (item: T, index: number) => React.ReactNode;
}

/** Calculate number of columns based on screen width and card size */
function calculateColumns(cardSize: MediaCardSize, gap: number): number {
  const { width } = Dimensions.get('window');
  const tv = isTV();
  
  const cardWidths = {
    sm: 92,
    md: 128,
    lg: 185,
  };
  
  const cardWidth = tv ? cardWidths.lg : cardWidths[cardSize];
  const totalCardWidth = cardWidth + gap;
  
  return Math.max(2, Math.floor(width / totalCardWidth));
}

/**
 * Media grid component.
 *
 * @example
 * <MediaGrid
 *   data={movies}
 *   cardSize="md"
 *   onItemPress={(movie) => navigate(`/movie/${movie.id}`)}
 * />
 */
export function MediaGrid<T extends MediaGridItem>({
  data,
  cardSize = 'md',
  columns: columnsProp,
  gap = 16,
  loading = false,
  skeletonCount = 12,
  onItemPress,
  className,
  imageBaseUrl = 'https://image.tmdb.org/t/p/w185',
  renderCustomItem,
  ...props
}: MediaGridProps<T>) {
  const columns = columnsProp ?? calculateColumns(cardSize, gap);

  // Render skeleton items when loading
  if (loading) {
    return (
      <View
        className={cn('flex-row flex-wrap', className)}
        style={{ gap }}
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonMediaCard key={i} />
        ))}
      </View>
    );
  }

  const renderItem = ({ item, index }: { item: T; index: number }): React.ReactElement | null => {
    if (renderCustomItem) {
      const customResult = renderCustomItem(item, index);
      return customResult as React.ReactElement | null;
    }

    const posterUrl = item.posterPath
      ? `${imageBaseUrl}${item.posterPath}`
      : null;

    const subtitle = item.subtitle ?? (item.year ? String(item.year) : undefined);

    return (
      <MediaCard
        posterUrl={posterUrl}
        title={item.title}
        subtitle={subtitle}
        progress={item.progress}
        isWatched={item.isWatched}
        rating={item.rating ?? undefined}
        size={cardSize}
        onPress={() => onItemPress?.(item)}
      />
    );
  };

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      numColumns={columns}
      key={columns} // Force re-render when columns change
      contentContainerStyle={{ gap }}
      columnWrapperStyle={{ gap }}
      showsVerticalScrollIndicator={false}
      className={className}
      {...props}
    />
  );
}

/** Simple grid without FlatList (for small lists) */
export function SimpleMediaGrid<T extends MediaGridItem>({
  data,
  cardSize = 'md',
  columns: _columns = 3,
  gap = 16,
  onItemPress,
  className,
  imageBaseUrl = 'https://image.tmdb.org/t/p/w185',
}: Omit<MediaGridProps<T>, 'loading' | 'skeletonCount'>) {
  return (
    <View
      className={cn('flex-row flex-wrap', className)}
      style={{ gap }}
    >
      {data.map((item) => {
        const posterUrl = item.posterPath
          ? `${imageBaseUrl}${item.posterPath}`
          : null;

        const subtitle = item.subtitle ?? (item.year ? String(item.year) : undefined);

        return (
          <MediaCard
            key={item.id}
            posterUrl={posterUrl}
            title={item.title}
            subtitle={subtitle}
            progress={item.progress}
            isWatched={item.isWatched}
            rating={item.rating ?? undefined}
            size={cardSize}
            onPress={() => onItemPress?.(item)}
          />
        );
      })}
    </View>
  );
}

export default MediaGrid;

