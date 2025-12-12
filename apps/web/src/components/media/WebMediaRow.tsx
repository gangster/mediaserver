/**
 * Web-optimized MediaRow component
 *
 * Horizontal scrolling row of media cards with:
 * - Responsive card widths (2-6 cards based on viewport)
 * - Scroll arrows on desktop
 * - Proper spacing and sizing for React Native Web
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions, Image } from 'react-native';
import { Link } from 'expo-router';
import type { MediaRowItem } from '@mediaserver/ui';

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
}

/** Calculate responsive padding to match px-4 sm:px-6 lg:px-8 */
function useResponsivePadding(): number {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 32; // lg: px-8
  if (width >= 640) return 24;  // sm: px-6
  return 16;                     // default: px-4
}

/** Calculate card width based on screen size */
function useCardWidth(): number {
  const { width } = useWindowDimensions();
  const padding = useResponsivePadding() * 2; // Both sides
  const gap = 12; // Gap between cards
  
  // Determine number of visible cards based on breakpoints
  let visibleCards: number;
  if (width >= 1280) {
    visibleCards = 6; // xl
  } else if (width >= 1024) {
    visibleCards = 5; // lg
  } else if (width >= 768) {
    visibleCards = 4; // md
  } else if (width >= 640) {
    visibleCards = 3; // sm
  } else {
    visibleCards = 2; // xs
  }
  
  // Calculate card width
  const availableWidth = width - padding;
  const totalGaps = (visibleCards - 1) * gap;
  const cardWidth = Math.floor((availableWidth - totalGaps) / visibleCards);
  
  // Cap at reasonable max
  return Math.min(cardWidth, 185);
}

/** Rating badge */
function RatingBadge({ rating }: { rating: number }) {
  const color =
    rating >= 7.5
      ? '#10b981' // emerald-500
      : rating >= 6
        ? '#eab308' // yellow-500
        : rating >= 4
          ? '#f97316' // orange-500
          : '#ef4444'; // red-500

  return (
    <View
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: color,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
        ★ {rating.toFixed(1)}
      </Text>
    </View>
  );
}

/** Poster placeholder */
function PosterPlaceholder({ title }: { title: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#3f3f46',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 32, color: 'rgba(255,255,255,0.3)', fontWeight: '700' }}>
        {title.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** Single media card */
function MediaRowCard({
  item,
  cardWidth,
  onPress,
}: {
  item: MediaRowItem;
  cardWidth: number;
  onPress?: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const hasImage = !!item.posterPath && !imageError;
  const hasRating = item.rating != null && item.rating > 0;
  const cardHeight = Math.floor(cardWidth * 1.5); // 2:3 aspect ratio

  return (
    <Pressable onPress={onPress} style={{ width: cardWidth }}>
      {/* Poster */}
      <View
        style={{
          width: cardWidth,
          height: cardHeight,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: '#27272a',
        }}
      >
        {/* Loading skeleton */}
        {!imageLoaded && hasImage && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#3f3f46',
            }}
          />
        )}

        {/* Placeholder */}
        {!hasImage && <PosterPlaceholder title={item.title} />}

        {/* Image */}
        {hasImage && (
          <Image
            source={{ uri: item.posterPath! }}
            style={{
              width: '100%',
              height: '100%',
              opacity: imageLoaded ? 1 : 0,
            }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />
        )}

        {/* Rating badge */}
        {hasRating && <RatingBadge rating={item.rating!} />}
      </View>

      {/* Title and year */}
      <View style={{ marginTop: 8 }}>
        <Text
          numberOfLines={1}
          style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}
        >
          {item.title}
        </Text>
        {item.year && (
          <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>
            {item.year}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** Skeleton card */
function SkeletonCard({ cardWidth }: { cardWidth: number }) {
  const cardHeight = Math.floor(cardWidth * 1.5);
  
  return (
    <View style={{ width: cardWidth }}>
      <View
        style={{
          width: cardWidth,
          height: cardHeight,
          borderRadius: 8,
          backgroundColor: '#3f3f46',
        }}
      />
      <View style={{ marginTop: 8 }}>
        <View
          style={{
            height: 14,
            width: '75%',
            backgroundColor: '#3f3f46',
            borderRadius: 4,
          }}
        />
        <View
          style={{
            height: 12,
            width: '50%',
            backgroundColor: '#3f3f46',
            borderRadius: 4,
            marginTop: 4,
          }}
        />
      </View>
    </View>
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
}: WebMediaRowProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const cardWidth = useCardWidth();
  const horizontalPadding = useResponsivePadding();
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 1024;

  // Update scroll button visibility
  const updateScrollButtons = useCallback((): void => {
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

  // Don't render empty rows
  if (!isLoading && data.length === 0) {
    return null;
  }

  const items = isLoading ? Array.from({ length: skeletonCount }) : data;
  const gap = 12;

  return (
    <View style={{ marginBottom: 32 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          paddingHorizontal: horizontalPadding,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '600', color: '#fff' }}>{title}</Text>
        {seeAllLink && !isLoading && data.length > 0 && (
          <Link href={seeAllLink as '/movies'} asChild>
            <Pressable>
              <Text style={{ fontSize: 14, color: '#34d399' }}>See All →</Text>
            </Pressable>
          </Link>
        )}
      </View>

      {/* Scrollable container */}
      <View style={{ position: 'relative' }}>
        {/* Left scroll arrow */}
        {isDesktop && canScrollLeft && (
          <Pressable
            onPress={() => scroll('left')}
            style={{
              position: 'absolute',
              left: horizontalPadding,
              top: '50%',
              transform: [{ translateY: -20 }],
              zIndex: 10,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.7)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 20 }}>‹</Text>
          </Pressable>
        )}

        {/* Right scroll arrow */}
        {isDesktop && canScrollRight && (
          <Pressable
            onPress={() => scroll('right')}
            style={{
              position: 'absolute',
              right: horizontalPadding,
              top: '50%',
              transform: [{ translateY: -20 }],
              zIndex: 10,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.7)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 20 }}>›</Text>
          </Pressable>
        )}

        {/* Cards container */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            gap: gap,
          }}
          style={{ paddingVertical: 8 }}
        >
          {items.map((item, index) =>
            isLoading ? (
              <SkeletonCard key={index} cardWidth={cardWidth} />
            ) : (
              <MediaRowCard
                key={(item as T).id}
                item={item as T}
                cardWidth={cardWidth}
                onPress={() => onItemPress?.(item as T)}
              />
            )
          )}
        </ScrollView>
      </View>
    </View>
  );
}

export default WebMediaRow;
export type { MediaRowItem };
