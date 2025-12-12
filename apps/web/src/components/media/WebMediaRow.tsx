/**
 * Web-optimized MediaRow component
 *
 * Wraps @mediaserver/ui MediaCard with web-specific features:
 * - Responsive card widths (2-6 cards based on viewport)
 * - Scroll arrows on desktop (appear on hover)
 * - Snap scrolling on mobile
 * - Horizontal scrollbar hidden
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { MediaCard, SkeletonMediaCard, type MediaRowItem } from '@mediaserver/ui';

export interface WebMediaRowProps<T extends MediaRowItem> {
  /** Section title */
  title: string;
  /** Data items */
  data: T[];
  /** Link for "See All" button */
  seeAllLink?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Number of skeleton items when loading */
  skeletonCount?: number;
  /** On item press callback */
  onItemPress?: (item: T) => void;
  /** Image base URL for posters */
  imageBaseUrl?: string;
}

/**
 * Scroll arrow button (desktop only)
 */
function ScrollArrow({
  direction,
  onPress,
  visible,
}: {
  direction: 'left' | 'right';
  onPress: () => void;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <Pressable
      onPress={onPress}
      className={`absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 hidden lg:flex items-center justify-center
        bg-black/70 active:bg-black/90 rounded-full
        ${direction === 'left' ? 'left-2' : 'right-2'}`}
    >
      <svg
        className={`w-6 h-6 text-white ${direction === 'left' ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </Pressable>
  );
}

/**
 * Web-optimized MediaRow component
 */
export function WebMediaRow<T extends MediaRowItem>({
  title,
  data,
  seeAllLink,
  isLoading = false,
  skeletonCount = 8,
  onItemPress,
  imageBaseUrl = 'http://localhost:3000/api/images',
}: WebMediaRowProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Update scroll button visibility
  const updateScrollButtons = useCallback((): void => {
    // ScrollView doesn't expose scrollLeft on native, this is web-only
    const container = scrollRef.current as unknown as {
      scrollLeft?: number;
      scrollWidth?: number;
      clientWidth?: number;
    };
    if (!container || container.scrollLeft === undefined) {
      return;
    }

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < (container.scrollWidth ?? 0) - (container.clientWidth ?? 0) - 1
    );
  }, []);

  // Set up scroll listener on web
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return undefined;

    // Web-only: add scroll event listener
    const webContainer = container as unknown as HTMLElement;
    if (typeof webContainer.addEventListener === 'function') {
      updateScrollButtons();
      webContainer.addEventListener('scroll', updateScrollButtons);
      window.addEventListener('resize', updateScrollButtons);

      return () => {
        webContainer.removeEventListener('scroll', updateScrollButtons);
        window.removeEventListener('resize', updateScrollButtons);
      };
    }
    return undefined;
  }, [updateScrollButtons, data]);

  // Scroll by visible width
  const scroll = useCallback((direction: 'left' | 'right') => {
    const container = scrollRef.current as unknown as HTMLElement;
    if (!container || typeof container.scrollTo !== 'function') return;

    const scrollAmount = Math.floor(container.clientWidth * 0.8);
    const newPosition =
      direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: newPosition,
      behavior: 'smooth',
    });
  }, []);

  // Get poster URL for an item
  const getPosterUrl = (item: T): string | null => {
    if (!item.posterPath) return null;
    // Assuming posterPath is like /movies/{id}/poster or a TMDB path
    if (item.posterPath.startsWith('http')) {
      return item.posterPath;
    }
    return `${imageBaseUrl}${item.posterPath}`;
  };

  // Don't render empty rows
  if (!isLoading && data.length === 0) {
    return null;
  }

  const items = isLoading ? Array.from({ length: skeletonCount }) : data;

  return (
    <View className="relative group/row mb-8">
      {/* Header */}
      <View className="flex flex-row items-center justify-between mb-3 sm:mb-4 px-4 sm:px-6 lg:px-8">
        <Text className="text-lg sm:text-xl font-semibold text-white">{title}</Text>
        {seeAllLink && !isLoading && data.length > 0 && (
          <Link href={seeAllLink as '/movies'} asChild>
            <Pressable className="touch-target">
              <Text className="text-sm text-emerald-400">See All →</Text>
            </Pressable>
          </Link>
        )}
      </View>

      {/* Scrollable container */}
      <View className="relative">
        {/* Scroll arrows - desktop only */}
        <ScrollArrow
          direction="left"
          onPress={() => scroll('left')}
          visible={canScrollLeft}
        />
        <ScrollArrow
          direction="right"
          onPress={() => scroll('right')}
          visible={canScrollRight}
        />

        {/* Cards container */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          className="py-2 sm:py-4"
        >
          {items.map((item, index) => (
            <View
              key={isLoading ? index : (item as T).id}
              className="flex-shrink-0 mr-3 sm:mr-4 w-[calc(50vw-24px)] sm:w-[calc(33.333vw-24px)] md:w-[calc(25vw-24px)] lg:w-[calc(20vw-24px)] xl:w-[calc(16.666vw-24px)] max-w-[185px]"
            >
              {isLoading ? (
                <SkeletonMediaCard />
              ) : (
                <MediaCard
                  posterUrl={getPosterUrl(item as T)}
                  title={(item as T).title}
                  subtitle={(item as T).subtitle ?? ((item as T).year ? String((item as T).year) : undefined)}
                  progress={(item as T).progress}
                  isWatched={(item as T).isWatched}
                  rating={(item as T).rating ?? undefined}
                  size="md"
                  onPress={() => onItemPress?.(item as T)}
                />
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

export default WebMediaRow;
