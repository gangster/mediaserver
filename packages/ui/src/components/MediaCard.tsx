/**
 * Media card component for displaying movies, shows, and episodes.
 */

import React from 'react';
import { View, Text, Pressable, Image, type PressableProps } from 'react-native';
import { cn } from '../utils/cn.js';
import { isTV } from '../utils/platform.js';
import { WatchProgressBar } from './ProgressBar.js';
import { Badge } from './Badge.js';

/** Media card sizes */
export type MediaCardSize = 'sm' | 'md' | 'lg';

/** Media card props */
export interface MediaCardProps extends Omit<PressableProps, 'style' | 'children'> {
  /** Poster image URL */
  posterUrl?: string | null;
  /** Poster blurhash for placeholder */
  posterBlurhash?: string | null;
  /** Title */
  title: string;
  /** Subtitle (year, episode number, etc.) */
  subtitle?: string;
  /** Watch progress percentage (0-100) */
  progress?: number;
  /** Is item watched */
  isWatched?: boolean;
  /** Card size */
  size?: MediaCardSize;
  /** Custom class name */
  className?: string;
  /** Show rating badge */
  rating?: number;
  /** Show any badge */
  badge?: string;
  /** Badge variant */
  badgeVariant?: 'default' | 'primary' | 'success' | 'warning' | 'ai' | 'premium';
  /** Focused state (for TV) */
  focused?: boolean;
}

/** Size configurations */
const sizeConfig: Record<MediaCardSize, {
  poster: { width: number; height: number };
  title: string;
  subtitle: string;
}> = {
  sm: {
    poster: { width: 92, height: 138 },
    title: 'text-xs',
    subtitle: 'text-xs',
  },
  md: {
    poster: { width: 128, height: 192 },
    title: 'text-sm',
    subtitle: 'text-xs',
  },
  lg: {
    poster: { width: 185, height: 278 },
    title: 'text-base',
    subtitle: 'text-sm',
  },
};

/**
 * Media card component.
 *
 * @example
 * <MediaCard
 *   posterUrl="https://image.tmdb.org/t/p/w185/poster.jpg"
 *   title="The Matrix"
 *   subtitle="1999"
 *   progress={45}
 *   onPress={() => navigate('/movie/123')}
 * />
 */
export function MediaCard({
  posterUrl,
  posterBlurhash,
  title,
  subtitle,
  progress,
  isWatched,
  size = 'md',
  className,
  rating,
  badge,
  badgeVariant = 'default',
  focused = false,
  ...props
}: MediaCardProps) {
  const tv = isTV();
  const config = sizeConfig[tv ? 'lg' : size];

  return (
    <Pressable
      className={cn(
        'active:opacity-80',
        tv && focused && 'scale-105',
        className
      )}
      {...props}
    >
      {({ pressed }) => (
        <View style={{ width: config.poster.width }}>
          {/* Poster container */}
          <View
            className={cn(
              'relative rounded-xl overflow-hidden bg-zinc-800',
              tv && focused && 'ring-4 ring-primary'
            )}
            style={{ 
              width: config.poster.width, 
              height: config.poster.height 
            }}
          >
            {posterUrl ? (
              <Image
                source={{ uri: posterUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center bg-zinc-800">
                <Text className="text-zinc-600 text-4xl">🎬</Text>
              </View>
            )}

            {/* Watch progress bar */}
            {progress !== undefined && progress > 0 && !isWatched && (
              <WatchProgressBar percentage={progress} />
            )}

            {/* Watched indicator */}
            {isWatched && (
              <View className="absolute top-2 right-2">
                <View className="w-6 h-6 rounded-full bg-success items-center justify-center">
                  <Text className="text-white text-xs">✓</Text>
                </View>
              </View>
            )}

            {/* Rating badge */}
            {rating !== undefined && rating > 0 && (
              <View className="absolute top-2 left-2">
                <View className="bg-black/70 px-1.5 py-0.5 rounded">
                  <Text className="text-yellow-400 text-xs font-bold">
                    ★ {rating.toFixed(1)}
                  </Text>
                </View>
              </View>
            )}

            {/* Custom badge */}
            {badge && (
              <View className="absolute bottom-2 left-2">
                <Badge variant={badgeVariant} size="sm">
                  {badge}
                </Badge>
              </View>
            )}
          </View>

          {/* Title and subtitle */}
          <View className="mt-2 px-1">
            <Text
              className={cn('text-white font-medium', config.title)}
              numberOfLines={2}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                className={cn('text-zinc-500 mt-0.5', config.subtitle)}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** Episode card with still image instead of poster */
export interface EpisodeCardProps extends Omit<PressableProps, 'style' | 'children'> {
  /** Still image URL */
  stillUrl?: string | null;
  /** Episode number */
  episodeNumber: number;
  /** Season number */
  seasonNumber?: number;
  /** Episode title */
  title?: string | null;
  /** Episode overview */
  overview?: string | null;
  /** Runtime in minutes */
  runtime?: number | null;
  /** Watch progress percentage */
  progress?: number;
  /** Is episode watched */
  isWatched?: boolean;
  /** Custom class name */
  className?: string;
  /** Focused state (for TV) */
  focused?: boolean;
}

/**
 * Episode card component.
 *
 * @example
 * <EpisodeCard
 *   stillUrl="https://image.tmdb.org/t/p/w300/still.jpg"
 *   episodeNumber={1}
 *   title="Pilot"
 *   runtime={45}
 *   progress={50}
 * />
 */
export function EpisodeCard({
  stillUrl,
  episodeNumber,
  seasonNumber,
  title,
  overview,
  runtime,
  progress,
  isWatched,
  className,
  focused = false,
  ...props
}: EpisodeCardProps) {
  const tv = isTV();

  return (
    <Pressable
      className={cn(
        'active:opacity-80',
        tv && focused && 'scale-102',
        className
      )}
      {...props}
    >
      {({ pressed }) => (
        <View className="flex-row bg-zinc-900 rounded-xl overflow-hidden">
          {/* Still image */}
          <View
            className={cn(
              'relative bg-zinc-800',
              tv && focused && 'ring-2 ring-primary'
            )}
            style={{ width: 168, height: 94 }}
          >
            {stillUrl ? (
              <Image
                source={{ uri: stillUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center">
                <Text className="text-zinc-600 text-2xl">📺</Text>
              </View>
            )}

            {/* Episode number overlay */}
            <View className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded">
              <Text className="text-white text-xs font-bold">
                {seasonNumber ? `S${seasonNumber}E${episodeNumber}` : `E${episodeNumber}`}
              </Text>
            </View>

            {/* Watch progress */}
            {progress !== undefined && progress > 0 && !isWatched && (
              <WatchProgressBar percentage={progress} />
            )}

            {/* Watched indicator */}
            {isWatched && (
              <View className="absolute top-1 right-1">
                <View className="w-5 h-5 rounded-full bg-success items-center justify-center">
                  <Text className="text-white text-xs">✓</Text>
                </View>
              </View>
            )}
          </View>

          {/* Info */}
          <View className="flex-1 p-3">
            <Text className="text-white font-medium" numberOfLines={1}>
              {title || `Episode ${episodeNumber}`}
            </Text>
            {runtime && (
              <Text className="text-zinc-500 text-xs mt-0.5">
                {runtime} min
              </Text>
            )}
            {overview && (
              <Text
                className="text-zinc-400 text-xs mt-1"
                numberOfLines={2}
              >
                {overview}
              </Text>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** Cast/crew card */
export interface CastCardProps extends Omit<PressableProps, 'style' | 'children'> {
  /** Profile image URL */
  profileUrl?: string | null;
  /** Person name */
  name: string;
  /** Character or role */
  character?: string;
  /** Department */
  department?: string;
  /** Custom class name */
  className?: string;
}

/**
 * Cast card component.
 */
export function CastCard({
  profileUrl,
  name,
  character,
  department,
  className,
  ...props
}: CastCardProps) {
  return (
    <Pressable className={cn('active:opacity-80', className)} {...props}>
      <View className="items-center" style={{ width: 100 }}>
        <View className="w-20 h-20 rounded-full overflow-hidden bg-zinc-800">
          {profileUrl ? (
            <Image
              source={{ uri: profileUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <Text className="text-zinc-600 text-2xl">👤</Text>
            </View>
          )}
        </View>
        <Text
          className="text-white text-sm font-medium mt-2 text-center"
          numberOfLines={2}
        >
          {name}
        </Text>
        {(character || department) && (
          <Text
            className="text-zinc-500 text-xs text-center mt-0.5"
            numberOfLines={1}
          >
            {character || department}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default MediaCard;

