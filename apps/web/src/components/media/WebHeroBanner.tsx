/**
 * Web-optimized HeroBanner component
 *
 * Features:
 * - Responsive height based on viewport
 * - Responsive text sizing
 * - Button stacking on mobile
 * - Overview hidden on mobile
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, Image, useWindowDimensions } from 'react-native';
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ color: '#facc15', fontSize: 16 }}>★</Text>
      <Text style={{ color: '#fff', fontWeight: '500', fontSize: 14 }}>{value.toFixed(1)}</Text>
    </View>
  );
}

/** Calculate responsive padding */
function useResponsivePadding(): number {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 32;
  if (width >= 640) return 24;
  return 16;
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const horizontalPadding = useResponsivePadding();

  const backdropUrl = getBackdropUrl(item, imageBaseUrl);
  const hasBackdrop = !!item.backdropPath && !imageError;

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Responsive calculations
  const isSmall = screenWidth >= 640;
  const isLarge = screenWidth >= 1024;
  const isXL = screenWidth >= 1280;

  // Height based on viewport and variant
  let bannerHeight: number;
  if (variant === 'full') {
    if (isLarge) bannerHeight = Math.max(screenHeight * 0.7, 500);
    else if (isSmall) bannerHeight = Math.max(screenHeight * 0.6, 400);
    else bannerHeight = Math.max(screenHeight * 0.5, 350);
  } else {
    if (isLarge) bannerHeight = Math.max(screenHeight * 0.5, 350);
    else if (isSmall) bannerHeight = Math.max(screenHeight * 0.45, 300);
    else bannerHeight = Math.max(screenHeight * 0.4, 280);
  }

  // Font sizes
  const titleFontSize = isXL ? 48 : isLarge ? 40 : isSmall ? 32 : 24;
  const overviewFontSize = isLarge ? 18 : isSmall ? 16 : 14;
  const buttonPaddingH = isSmall ? 24 : 16;
  const buttonPaddingV = isSmall ? 12 : 10;

  const linkTo = item.type === 'movie' ? `/movies/${item.id}` : `/tv/${item.id}`;

  return (
    <View style={{ position: 'relative', height: bannerHeight, overflow: 'hidden' }}>
      {/* Background image */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {/* Loading state */}
        {!imageLoaded && hasBackdrop && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#18181b',
            }}
          />
        )}

        {/* Placeholder gradient for missing backdrop */}
        {!hasBackdrop && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#18181b',
            }}
          />
        )}

        {/* Actual backdrop */}
        {hasBackdrop && (
          <Image
            source={{ uri: backdropUrl }}
            style={{
              width: '100%',
              height: '120%', // Slightly larger to allow positioning
              opacity: imageLoaded ? 1 : 0,
              // @ts-expect-error - web-only objectPosition
              objectPosition: 'center top', // Show top of image (faces, etc.)
            }}
            resizeMode="cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {/* Bottom gradient overlay - fades to page background (#18181b = zinc-900) */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '70%',
            // @ts-expect-error - web-only gradient
            background: 'linear-gradient(to top, #18181b 0%, #18181b 10%, rgba(24, 24, 27, 0.95) 25%, rgba(24, 24, 27, 0.7) 50%, transparent 100%)',
          }}
        />

        {/* Left gradient overlay for text readability */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '70%',
            // @ts-expect-error - web-only gradient
            background: 'linear-gradient(to right, rgba(24, 24, 27, 0.9) 0%, rgba(24, 24, 27, 0.6) 40%, transparent 100%)',
          }}
        />
      </View>

      {/* Content */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            maxWidth: 768,
            paddingHorizontal: horizontalPadding,
            paddingBottom: isLarge ? 64 : isSmall ? 48 : 32,
            gap: isLarge ? 16 : isSmall ? 12 : 8,
          }}
        >
          {/* Title */}
          <Text
            numberOfLines={2}
            style={{
              fontSize: titleFontSize,
              fontWeight: '700',
              color: '#fff',
              textShadowColor: 'rgba(0,0,0,0.5)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 4,
            }}
          >
            {item.title}
          </Text>

          {/* Metadata */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: isSmall ? 16 : 8 }}>
            {item.voteAverage != null && item.voteAverage > 0 && (
              <Rating value={item.voteAverage} />
            )}
            {item.year && (
              <Text style={{ fontSize: isSmall ? 14 : 12, color: '#d4d4d8' }}>{item.year}</Text>
            )}
          </View>

          {/* Overview - hidden on mobile */}
          {isSmall && item.overview && (
            <Text
              style={{
                fontSize: overviewFontSize,
                color: '#e4e4e7',
                maxWidth: 512,
                lineHeight: overviewFontSize * 1.5,
              }}
            >
              {item.overview}
            </Text>
          )}

          {/* Action buttons */}
          <View
            style={{
              flexDirection: isSmall ? 'row' : 'column',
              gap: isSmall ? 12 : 8,
              paddingTop: isSmall ? 8 : 4,
            }}
          >
            <Pressable
              onPress={() => onPlay?.(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingHorizontal: buttonPaddingH,
                paddingVertical: buttonPaddingV,
                backgroundColor: '#fff',
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#000', fontSize: 16 }}>▶</Text>
              <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>Play</Text>
            </Pressable>

            {onMoreInfo ? (
              <Pressable
                onPress={() => onMoreInfo(item)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingHorizontal: buttonPaddingH,
                  paddingVertical: buttonPaddingV,
                  backgroundColor: 'rgba(82, 82, 91, 0.8)',
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16 }}>ⓘ</Text>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                  {isSmall ? 'More Info' : 'Info'}
                </Text>
              </Pressable>
            ) : (
              <Link href={linkTo as '/movies/[id]'} asChild>
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingHorizontal: buttonPaddingH,
                    paddingVertical: buttonPaddingV,
                    backgroundColor: 'rgba(82, 82, 91, 0.8)',
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 16 }}>ⓘ</Text>
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                    {isSmall ? 'More Info' : 'Info'}
                  </Text>
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const horizontalPadding = useResponsivePadding();

  const isSmall = screenWidth >= 640;
  const isLarge = screenWidth >= 1024;

  let bannerHeight: number;
  if (variant === 'full') {
    if (isLarge) bannerHeight = Math.max(screenHeight * 0.7, 500);
    else if (isSmall) bannerHeight = Math.max(screenHeight * 0.6, 400);
    else bannerHeight = Math.max(screenHeight * 0.5, 350);
  } else {
    if (isLarge) bannerHeight = Math.max(screenHeight * 0.5, 350);
    else if (isSmall) bannerHeight = Math.max(screenHeight * 0.45, 300);
    else bannerHeight = Math.max(screenHeight * 0.4, 280);
  }

  return (
    <View style={{ position: 'relative', height: bannerHeight, backgroundColor: '#18181b' }}>
      {/* Gradient overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          // @ts-expect-error - web-only gradient
          background: 'linear-gradient(to top, #18181b 0%, rgba(39, 39, 42, 0.7) 50%, #27272a 100%)',
        }}
      />

      {/* Content skeleton */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            maxWidth: 768,
            paddingHorizontal: horizontalPadding,
            paddingBottom: isLarge ? 64 : isSmall ? 48 : 32,
            gap: isLarge ? 16 : isSmall ? 12 : 8,
          }}
        >
          {/* Title skeleton */}
          <View
            style={{
              height: isLarge ? 48 : isSmall ? 40 : 32,
              width: '66%',
              backgroundColor: '#3f3f46',
              borderRadius: 8,
            }}
          />

          {/* Metadata skeleton */}
          <View style={{ flexDirection: 'row', gap: isSmall ? 16 : 8 }}>
            <View style={{ height: isSmall ? 20 : 16, width: 64, backgroundColor: '#3f3f46', borderRadius: 4 }} />
            <View style={{ height: isSmall ? 20 : 16, width: 48, backgroundColor: '#3f3f46', borderRadius: 4 }} />
          </View>

          {/* Overview skeleton - hidden on mobile */}
          {isSmall && (
            <View style={{ gap: 8 }}>
              <View style={{ height: 16, width: '100%', backgroundColor: '#3f3f46', borderRadius: 4 }} />
              <View style={{ height: 16, width: '80%', backgroundColor: '#3f3f46', borderRadius: 4 }} />
              {isLarge && (
                <View style={{ height: 16, width: '66%', backgroundColor: '#3f3f46', borderRadius: 4 }} />
              )}
            </View>
          )}

          {/* Button skeleton */}
          <View
            style={{
              flexDirection: isSmall ? 'row' : 'column',
              gap: isSmall ? 12 : 8,
              paddingTop: isSmall ? 8 : 4,
            }}
          >
            <View
              style={{
                height: isSmall ? 48 : 40,
                width: isSmall ? 96 : '100%',
                backgroundColor: '#3f3f46',
                borderRadius: 8,
              }}
            />
            <View
              style={{
                height: isSmall ? 48 : 40,
                width: isSmall ? 112 : '100%',
                backgroundColor: '#52525b',
                borderRadius: 8,
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export default WebHeroBanner;
