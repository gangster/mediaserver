/**
 * ShowCard component
 *
 * Enhanced card for TV shows with unwatched episode badge,
 * watched checkmark, year range, and various display modes.
 * Adapted from forreel for React Native Web.
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, Image, type ViewStyle } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePreferencesStore } from '../../../stores/preferences';

/** Show item data */
export interface ShowItem {
  id: string;
  title: string;
  year: number | null;
  /** End year for shows that have ended */
  endYear?: number | null;
  /** Show status (Returning, Ended, etc.) */
  status?: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number | null;
  overview: string | null;
  /** Number of unwatched episodes */
  unwatchedCount?: number;
  /** Total episode count */
  episodeCount?: number;
  /** Season count */
  seasonCount?: number;
  /** Network name */
  network?: string | null;
}

export interface ShowCardProps {
  item: ShowItem;
  /** Display variant */
  variant?: 'poster' | 'posterCard' | 'thumb' | 'thumbCard' | 'list' | 'banner';
  /** Called when card is clicked */
  onClick?: (item: ShowItem) => void;
  /** Priority loading for above-fold images */
  priority?: boolean;
}

/** Get image URL for a show */
function getImageUrl(
  path: string | null | undefined,
  type: 'poster' | 'backdrop',
  itemId: string
): string {
  if (!path) return '';
  return `http://localhost:3000/api/images/shows/${itemId}/${type}?size=medium`;
}

/** Format year range for shows */
function formatYearRange(
  year: number | null,
  endYear: number | null | undefined,
  status: string | null | undefined
): string {
  if (!year) return '';
  if (status === 'Ended' && endYear && endYear !== year) {
    return `${year}–${endYear}`;
  }
  if (status === 'Returning Series' || status === 'In Production') {
    return `${year}–`;
  }
  return String(year);
}

/** Rating badge component */
function RatingBadge({ rating }: { rating: number }) {
  const bgColor =
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
        backgroundColor: bgColor,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}

/** Unwatched episode badge */
function UnwatchedBadge({ count }: { count: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#10b981',
        minWidth: 20,
        height: 20,
        paddingHorizontal: 6,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{count}</Text>
    </View>
  );
}

/** Watched checkmark badge */
function WatchedBadge() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#10b981',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="checkmark" size={12} color="#fff" />
    </View>
  );
}

/** Placeholder for missing images */
function ImagePlaceholder({ title, variant }: { title: string; variant: 'poster' | 'backdrop' }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#27272a',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: 'rgba(255,255,255,0.3)',
          fontWeight: '700',
          fontSize: variant === 'poster' ? 48 : 32,
        }}
      >
        {title.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** Poster variant card */
function PosterCard({
  item,
  onClick,
  showMetadata,
}: {
  item: ShowItem;
  onClick?: (item: ShowItem) => void;
  showMetadata?: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { showRatings, reduceMotion } = usePreferencesStore();

  const imageUrl = getImageUrl(item.posterPath, 'poster', item.id);
  const hasImage = !!item.posterPath && !imageError;
  const hasRating = showRatings && item.voteAverage != null && item.voteAverage > 0;
  const isFullyWatched = item.unwatchedCount === 0 && (item.episodeCount ?? 0) > 0;
  const hasUnwatched = (item.unwatchedCount ?? 0) > 0;
  const yearRange = formatYearRange(item.year, item.endYear, item.status);

  const handlePress = useCallback(() => {
    if (onClick) onClick(item);
  }, [onClick, item]);

  const cardStyle: ViewStyle = {
    transform: [{ scale: isHovered && !reduceMotion ? 1.05 : 1 }],
  };

  const content = (
    <View style={cardStyle}>
      {/* Poster image */}
      <View
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 8,
          backgroundColor: '#27272a',
          aspectRatio: 2 / 3,
        }}
      >
        {/* Placeholder */}
        {!hasImage && <ImagePlaceholder title={item.title} variant="poster" />}

        {/* Image */}
        {hasImage && (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        )}

        {/* Rating badge */}
        {hasRating && <RatingBadge rating={item.voteAverage!} />}

        {/* Unwatched/Watched badge */}
        {isFullyWatched ? <WatchedBadge /> : hasUnwatched && <UnwatchedBadge count={item.unwatchedCount!} />}

        {/* Hover play overlay */}
        {isHovered && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          </View>
        )}
      </View>

      {/* Metadata (for posterCard variant) */}
      {showMetadata && (
        <View style={{ marginTop: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              color: isHovered ? '#10b981' : '#fff',
              fontSize: 14,
              fontWeight: '500',
            }}
          >
            {item.title}
          </Text>
          <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{yearRange}</Text>
        </View>
      )}
    </View>
  );

  const pressableProps = {
    onHoverIn: () => setIsHovered(true),
    onHoverOut: () => setIsHovered(false),
    style: { width: '100%' } as ViewStyle,
  };

  if (onClick) {
    return (
      <Pressable onPress={handlePress} {...pressableProps}>
        {content}
      </Pressable>
    );
  }

  return (
    <Link href={`/tv/${item.id}` as `/tv/${string}`} asChild>
      <Pressable {...pressableProps}>{content}</Pressable>
    </Link>
  );
}

/** Thumb/Landscape variant card */
function ThumbCard({
  item,
  onClick,
  showMetadata,
}: {
  item: ShowItem;
  onClick?: (item: ShowItem) => void;
  showMetadata?: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { showRatings, reduceMotion } = usePreferencesStore();

  const imageUrl = getImageUrl(item.backdropPath, 'backdrop', item.id);
  const hasImage = !!item.backdropPath && !imageError;
  const hasRating = showRatings && item.voteAverage != null && item.voteAverage > 0;
  const isFullyWatched = item.unwatchedCount === 0 && (item.episodeCount ?? 0) > 0;
  const hasUnwatched = (item.unwatchedCount ?? 0) > 0;
  const yearRange = formatYearRange(item.year, item.endYear, item.status);

  const handlePress = useCallback(() => {
    if (onClick) onClick(item);
  }, [onClick, item]);

  const cardStyle: ViewStyle = {
    transform: [{ scale: isHovered && !reduceMotion ? 1.05 : 1 }],
  };

  const content = (
    <View style={cardStyle}>
      {/* Backdrop image */}
      <View
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 8,
          backgroundColor: '#27272a',
          aspectRatio: 16 / 9,
        }}
      >
        {/* Placeholder */}
        {!hasImage && <ImagePlaceholder title={item.title} variant="backdrop" />}

        {/* Image */}
        {hasImage && (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        )}

        {/* Gradient overlay for title (when not showing metadata below) */}
        {!showMetadata && (
          <>
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
              } as ViewStyle}
            />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 }}>
              <Text numberOfLines={1} style={{ color: '#fff', fontSize: 14, fontWeight: '500' }}>
                {item.title}
              </Text>
              <Text style={{ color: '#d4d4d8', fontSize: 12 }}>{yearRange}</Text>
            </View>
          </>
        )}

        {/* Rating badge */}
        {hasRating && <RatingBadge rating={item.voteAverage!} />}

        {/* Unwatched/Watched badge */}
        {isFullyWatched ? <WatchedBadge /> : hasUnwatched && <UnwatchedBadge count={item.unwatchedCount!} />}

        {/* Hover play overlay */}
        {isHovered && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          </View>
        )}
      </View>

      {/* Metadata (for thumbCard variant) */}
      {showMetadata && (
        <View style={{ marginTop: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              color: isHovered ? '#10b981' : '#fff',
              fontSize: 14,
              fontWeight: '500',
            }}
          >
            {item.title}
          </Text>
          <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{yearRange}</Text>
        </View>
      )}
    </View>
  );

  const pressableProps = {
    onHoverIn: () => setIsHovered(true),
    onHoverOut: () => setIsHovered(false),
    style: { width: '100%' } as ViewStyle,
  };

  if (onClick) {
    return (
      <Pressable onPress={handlePress} {...pressableProps}>
        {content}
      </Pressable>
    );
  }

  return (
    <Link href={`/tv/${item.id}` as `/tv/${string}`} asChild>
      <Pressable {...pressableProps}>{content}</Pressable>
    </Link>
  );
}

/** List variant card (compact horizontal) */
function ListCard({
  item,
  onClick,
}: {
  item: ShowItem;
  onClick?: (item: ShowItem) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { showRatings } = usePreferencesStore();

  const imageUrl = getImageUrl(item.posterPath, 'poster', item.id);
  const hasImage = !!item.posterPath && !imageError;
  const hasRating = showRatings && item.voteAverage != null && item.voteAverage > 0;
  const isFullyWatched = item.unwatchedCount === 0 && (item.episodeCount ?? 0) > 0;
  const hasUnwatched = (item.unwatchedCount ?? 0) > 0;
  const yearRange = formatYearRange(item.year, item.endYear, item.status);

  const handlePress = useCallback(() => {
    if (onClick) onClick(item);
  }, [onClick, item]);

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        padding: 8,
        borderRadius: 8,
        backgroundColor: isHovered ? 'rgba(39,39,42,0.5)' : 'transparent',
      }}
    >
      {/* Small poster */}
      <View
        style={{
          position: 'relative',
          width: 48,
          height: 72,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: '#27272a',
        }}
      >
        {!hasImage && <ImagePlaceholder title={item.title} variant="poster" />}
        {hasImage && (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ color: isHovered ? '#10b981' : '#fff', fontWeight: '500' }}
        >
          {item.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{yearRange}</Text>
          {item.seasonCount && (
            <>
              <Text style={{ color: '#a1a1aa', fontSize: 14 }}>•</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
                {item.seasonCount} {item.seasonCount === 1 ? 'Season' : 'Seasons'}
              </Text>
            </>
          )}
          {item.network && (
            <>
              <Text style={{ color: '#a1a1aa', fontSize: 14 }}>•</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{item.network}</Text>
            </>
          )}
        </View>
      </View>

      {/* Right side badges */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {hasRating && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="star" size={16} color="#facc15" />
            <Text style={{ color: '#d4d4d8', fontSize: 14 }}>{item.voteAverage!.toFixed(1)}</Text>
          </View>
        )}
        {isFullyWatched ? (
          <View
            style={{
              backgroundColor: '#10b981',
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        ) : (
          hasUnwatched && (
            <View
              style={{
                backgroundColor: '#10b981',
                minWidth: 20,
                height: 20,
                paddingHorizontal: 6,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{item.unwatchedCount}</Text>
            </View>
          )
        )}
      </View>
    </View>
  );

  const pressableProps = {
    onHoverIn: () => setIsHovered(true),
    onHoverOut: () => setIsHovered(false),
    style: { width: '100%' } as ViewStyle,
  };

  if (onClick) {
    return (
      <Pressable onPress={handlePress} {...pressableProps}>
        {content}
      </Pressable>
    );
  }

  return (
    <Link href={`/tv/${item.id}` as `/tv/${string}`} asChild>
      <Pressable {...pressableProps}>{content}</Pressable>
    </Link>
  );
}

/** Banner variant card (full-width horizontal) */
function BannerCard({
  item,
  onClick,
}: {
  item: ShowItem;
  onClick?: (item: ShowItem) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { showRatings, reduceMotion } = usePreferencesStore();

  const imageUrl = getImageUrl(item.backdropPath, 'backdrop', item.id);
  const hasImage = !!item.backdropPath && !imageError;
  const hasRating = showRatings && item.voteAverage != null && item.voteAverage > 0;
  const isFullyWatched = item.unwatchedCount === 0 && (item.episodeCount ?? 0) > 0;
  const hasUnwatched = (item.unwatchedCount ?? 0) > 0;
  const yearRange = formatYearRange(item.year, item.endYear, item.status);

  const handlePress = useCallback(() => {
    if (onClick) onClick(item);
  }, [onClick, item]);

  const cardStyle: ViewStyle = {
    transform: [{ scale: isHovered && !reduceMotion ? 1.02 : 1 }],
  };

  const content = (
    <View style={cardStyle}>
      <View
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 8,
          backgroundColor: '#27272a',
          aspectRatio: 21 / 9,
        }}
      >
        {/* Placeholder */}
        {!hasImage && <ImagePlaceholder title={item.title} variant="backdrop" />}

        {/* Image */}
        {hasImage && (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        )}

        {/* Gradient overlay */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(to right, rgba(0,0,0,0.8), rgba(0,0,0,0.4), transparent)',
          } as ViewStyle}
        />

        {/* Content */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: 24 }}>
          <View style={{ maxWidth: 400 }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 }}>{item.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {yearRange && <Text style={{ color: '#d4d4d8', fontSize: 14 }}>{yearRange}</Text>}
              {item.seasonCount && (
                <>
                  <Text style={{ color: '#d4d4d8', fontSize: 14 }}>•</Text>
                  <Text style={{ color: '#d4d4d8', fontSize: 14 }}>
                    {item.seasonCount} {item.seasonCount === 1 ? 'Season' : 'Seasons'}
                  </Text>
                </>
              )}
              {hasRating && (
                <>
                  <Text style={{ color: '#d4d4d8', fontSize: 14 }}>•</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="star" size={16} color="#facc15" />
                    <Text style={{ color: '#d4d4d8', fontSize: 14 }}>{item.voteAverage!.toFixed(1)}</Text>
                  </View>
                </>
              )}
            </View>
            {item.overview && (
              <Text numberOfLines={2} style={{ color: '#a1a1aa', fontSize: 14 }}>
                {item.overview}
              </Text>
            )}
          </View>
        </View>

        {/* Unwatched/Watched badge */}
        <View style={{ position: 'absolute', top: 16, right: 16 }}>
          {isFullyWatched ? (
            <View
              style={{
                backgroundColor: '#10b981',
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
          ) : (
            hasUnwatched && (
              <View
                style={{
                  backgroundColor: '#10b981',
                  minWidth: 24,
                  height: 24,
                  paddingHorizontal: 8,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{item.unwatchedCount}</Text>
              </View>
            )
          )}
        </View>

        {/* Hover play overlay */}
        {isHovered && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const pressableProps = {
    onHoverIn: () => setIsHovered(true),
    onHoverOut: () => setIsHovered(false),
    style: { width: '100%' } as ViewStyle,
  };

  if (onClick) {
    return (
      <Pressable onPress={handlePress} {...pressableProps}>
        {content}
      </Pressable>
    );
  }

  return (
    <Link href={`/tv/${item.id}` as `/tv/${string}`} asChild>
      <Pressable {...pressableProps}>{content}</Pressable>
    </Link>
  );
}

/**
 * ShowCard component
 *
 * Renders a show card in the specified variant style.
 */
export function ShowCard({ item, variant = 'posterCard', onClick }: ShowCardProps) {
  switch (variant) {
    case 'poster':
      return <PosterCard item={item} onClick={onClick} showMetadata={false} />;
    case 'posterCard':
      return <PosterCard item={item} onClick={onClick} showMetadata={true} />;
    case 'thumb':
      return <ThumbCard item={item} onClick={onClick} showMetadata={false} />;
    case 'thumbCard':
      return <ThumbCard item={item} onClick={onClick} showMetadata={true} />;
    case 'list':
      return <ListCard item={item} onClick={onClick} />;
    case 'banner':
      return <BannerCard item={item} onClick={onClick} />;
    default:
      return <PosterCard item={item} onClick={onClick} showMetadata={true} />;
  }
}

/**
 * ShowCard skeleton for loading states
 */
export function ShowCardSkeleton({ variant = 'posterCard' }: { variant?: ShowCardProps['variant'] }) {
  const baseStyle: ViewStyle = {
    backgroundColor: '#27272a',
    borderRadius: 8,
  };

  switch (variant) {
    case 'poster':
      return <View style={{ ...baseStyle, aspectRatio: 2 / 3 }} />;
    case 'posterCard':
      return (
        <View>
          <View style={{ ...baseStyle, aspectRatio: 2 / 3 }} />
          <View style={{ marginTop: 8, gap: 4 }}>
            <View style={{ ...baseStyle, height: 16, width: '75%' }} />
            <View style={{ ...baseStyle, height: 12, width: '50%' }} />
          </View>
        </View>
      );
    case 'thumb':
      return <View style={{ ...baseStyle, aspectRatio: 16 / 9 }} />;
    case 'thumbCard':
      return (
        <View>
          <View style={{ ...baseStyle, aspectRatio: 16 / 9 }} />
          <View style={{ marginTop: 8, gap: 4 }}>
            <View style={{ ...baseStyle, height: 16, width: '75%' }} />
            <View style={{ ...baseStyle, height: 12, width: '50%' }} />
          </View>
        </View>
      );
    case 'list':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 8 }}>
          <View style={{ ...baseStyle, width: 48, height: 72 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ ...baseStyle, height: 16, width: '50%' }} />
            <View style={{ ...baseStyle, height: 12, width: '33%' }} />
          </View>
        </View>
      );
    case 'banner':
      return <View style={{ ...baseStyle, aspectRatio: 21 / 9 }} />;
    default:
      return (
        <View>
          <View style={{ ...baseStyle, aspectRatio: 2 / 3 }} />
          <View style={{ marginTop: 8, gap: 4 }}>
            <View style={{ ...baseStyle, height: 16, width: '75%' }} />
            <View style={{ ...baseStyle, height: 12, width: '50%' }} />
          </View>
        </View>
      );
  }
}

export default ShowCard;
