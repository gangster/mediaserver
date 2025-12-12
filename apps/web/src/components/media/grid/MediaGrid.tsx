/**
 * MediaGrid component
 *
 * Renders movies or shows in a responsive grid layout with the specified view mode.
 * Handles all 6 view modes: poster, posterCard, thumb, thumbCard, list, banner.
 * Adapted from forreel for React Native Web.
 */

import { View, Text, useWindowDimensions, type ViewStyle } from 'react-native';
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
  /** Loading state */
  isLoading?: boolean;
  /** Called when a card is clicked */
  onItemClick?: (item: T) => void;
  /** Number of skeleton items to show initially */
  skeletonCount?: number;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * Calculate grid columns based on view mode and screen width
 */
function getGridConfig(
  viewMode: ViewMode,
  screenWidth: number
): { columns: number; gap: number } {
  // Account for sidebar and padding
  const contentWidth = screenWidth - 256 - 64; // sidebar + padding

  switch (viewMode) {
    case 'poster':
    case 'posterCard': {
      // Target card width: ~150px
      const targetWidth = 150;
      const columns = Math.max(2, Math.min(8, Math.floor(contentWidth / targetWidth)));
      return { columns, gap: 16 };
    }
    case 'thumb':
    case 'thumbCard': {
      // Target card width: ~300px
      const targetWidth = 300;
      const columns = Math.max(1, Math.min(4, Math.floor(contentWidth / targetWidth)));
      return { columns, gap: 16 };
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
 * MediaGrid component
 */
export function MediaGrid<T extends MovieItem | ShowItem>({
  mediaType,
  items,
  viewMode,
  isLoading = false,
  onItemClick,
  skeletonCount = 12,
  emptyMessage = 'No items found',
}: MediaGridProps<T>) {
  const { width: screenWidth } = useWindowDimensions();
  const { columns, gap } = getGridConfig(viewMode, screenWidth);

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
  );
}

export default MediaGrid;
