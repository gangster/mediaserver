/**
 * MediaGrid component
 *
 * Renders movies or shows in a responsive grid layout with the specified view mode.
 * Handles all 6 view modes: poster, posterCard, thumb, thumbCard, list, banner.
 * Supports infinite scroll for loading more content.
 * Adapted from forreel for React Native Web.
 */

import { useRef, useEffect } from 'react';
import { View, Text, useWindowDimensions, ActivityIndicator, type ViewStyle } from 'react-native';
import { MovieCard, MovieCardSkeleton, type MovieItem } from '../cards/MovieCard';
import { ShowCard, ShowCardSkeleton, type ShowItem } from '../cards/ShowCard';
import type { MoviesViewMode, ShowsViewMode } from '../../../stores/preferences';
import { Ionicons } from '@expo/vector-icons';

type ViewMode = MoviesViewMode | ShowsViewMode;

export interface MediaGridProps<T extends MovieItem | ShowItem> {
  /** Media type */
  mediaType: 'movies' | 'shows';
  /** Items to display */
  items: T[];
  /** Current view mode */
  viewMode: ViewMode;
  /** Loading state (initial load) */
  isLoading?: boolean;
  /** Called when a card is clicked */
  onItemClick?: (item: T) => void;
  /** Called when user scrolls near bottom (for infinite scroll) */
  onLoadMore?: () => void;
  /** Whether there are more items to load */
  hasMore?: boolean;
  /** Loading more items */
  isLoadingMore?: boolean;
  /** Number of skeleton items to show initially */
  skeletonCount?: number;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * Calculate grid columns based on view mode and screen width
 * Matches forreel's responsive breakpoints:
 * - Mobile (< 640px): 2 columns poster, 1 column thumb
 * - sm (640px+): 3 columns poster, 2 columns thumb
 * - md (768px+): 4 columns poster
 * - lg (1024px+): 5 columns poster, 3 columns thumb
 * - xl (1280px+): 6 columns poster, 4 columns thumb
 * - 2xl (1536px+): 8 columns poster
 */
function getGridConfig(
  viewMode: ViewMode,
  screenWidth: number
): { columns: number; gap: number } {
  switch (viewMode) {
    case 'poster':
    case 'posterCard': {
      // Responsive columns matching forreel: 2 -> 3 -> 4 -> 5 -> 6 -> 8
      let columns: number;
      if (screenWidth >= 1536) columns = 8;       // 2xl
      else if (screenWidth >= 1280) columns = 6;  // xl
      else if (screenWidth >= 1024) columns = 5;  // lg
      else if (screenWidth >= 768) columns = 4;   // md
      else if (screenWidth >= 640) columns = 3;   // sm
      else columns = 2;                            // mobile

      const gap = screenWidth >= 1024 ? 20 : screenWidth >= 768 ? 16 : 12;
      return { columns, gap };
    }
    case 'thumb':
    case 'thumbCard': {
      // Responsive columns: 1 -> 2 -> 3 -> 4
      let columns: number;
      if (screenWidth >= 1280) columns = 4;       // xl
      else if (screenWidth >= 1024) columns = 3;  // lg
      else if (screenWidth >= 640) columns = 2;   // sm
      else columns = 1;                            // mobile

      const gap = screenWidth >= 1024 ? 20 : 16;
      return { columns, gap };
    }
    case 'list':
      return { columns: 1, gap: 4 };
    case 'banner':
      return { columns: 1, gap: 16 };
    default:
      return { columns: 6, gap: 16 };
  }
}

/**
 * Empty state component
 */
function EmptyState({ message, mediaType }: { message: string; mediaType: 'movies' | 'shows' }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
      <Ionicons
        name={mediaType === 'movies' ? 'film-outline' : 'tv-outline'}
        size={64}
        color="#52525b"
        style={{ marginBottom: 16 }}
      />
      <Text style={{ color: '#a1a1aa', fontSize: 18 }}>{message}</Text>
    </View>
  );
}

/**
 * Loading spinner for infinite scroll
 */
function LoadMoreSpinner() {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
      <ActivityIndicator size="large" color="#10b981" />
    </View>
  );
}

/**
 * MediaGrid component
 */
export function MediaGrid<T extends MovieItem | ShowItem>({
  mediaType,
  items,
  viewMode,
  isLoading = false,
  onItemClick,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  skeletonCount = 12,
  emptyMessage = 'No items found',
}: MediaGridProps<T>) {
  const { width: screenWidth } = useWindowDimensions();
  const { columns, gap } = getGridConfig(viewMode, screenWidth);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const target = loadMoreRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [onLoadMore, hasMore, isLoadingMore]);

  // Calculate item width for grid layouts
  const isGridLayout = viewMode !== 'list' && viewMode !== 'banner';
  const itemWidth = isGridLayout ? `calc(${100 / columns}% - ${(gap * (columns - 1)) / columns}px)` : '100%';

  const gridStyle: ViewStyle = isGridLayout
    ? {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap,
      }
    : {
        flexDirection: 'column',
        gap,
      };

  // Initial loading state
  if (isLoading) {
    return (
      <View style={gridStyle}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <View key={i} style={{ width: itemWidth } as ViewStyle}>
            {mediaType === 'movies' ? (
              <MovieCardSkeleton variant={viewMode} />
            ) : (
              <ShowCardSkeleton variant={viewMode} />
            )}
          </View>
        ))}
      </View>
    );
  }

  // Empty state
  if (items.length === 0) {
    return <EmptyState message={emptyMessage} mediaType={mediaType} />;
  }

  return (
    <View>
      {/* Grid */}
      <View style={gridStyle}>
        {items.map((item, index) => (
          <View key={item.id} style={{ width: itemWidth } as ViewStyle}>
            {mediaType === 'movies' ? (
              <MovieCard
                item={item as MovieItem}
                variant={viewMode}
                onClick={onItemClick as ((item: MovieItem) => void) | undefined}
                priority={index < 12}
              />
            ) : (
              <ShowCard
                item={item as ShowItem}
                variant={viewMode}
                onClick={onItemClick as ((item: ShowItem) => void) | undefined}
                priority={index < 12}
              />
            )}
          </View>
        ))}
      </View>

      {/* Load more trigger - use div for web IntersectionObserver compatibility */}
      {hasMore && (
        <div ref={loadMoreRef} style={{ width: '100%' }}>
          {isLoadingMore && <LoadMoreSpinner />}
        </div>
      )}
    </View>
  );
}

export default MediaGrid;
