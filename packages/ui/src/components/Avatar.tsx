/**
 * Avatar component for user profile images.
 */

import React from 'react';
import { View, Text, Image, type ImageSourcePropType } from 'react-native';
import { cn } from '../utils/cn.js';

/** Avatar sizes */
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/** Avatar props */
export interface AvatarProps {
  /** Image source URL or require() */
  src?: string | ImageSourcePropType | null;
  /** Alt text / accessible label */
  alt?: string;
  /** Fallback initials (2 characters) */
  fallback?: string;
  /** Avatar size */
  size?: AvatarSize;
  /** Custom class name */
  className?: string;
  /** Show online indicator */
  online?: boolean;
  /** Custom border color */
  borderColor?: string;
}

/** Size configurations */
const sizeConfig: Record<
  AvatarSize,
  { container: string; text: string; indicator: string; sizePx: number }
> = {
  xs: {
    container: 'w-6 h-6',
    text: 'text-xs',
    indicator: 'w-2 h-2 right-0 bottom-0',
    sizePx: 24,
  },
  sm: {
    container: 'w-8 h-8',
    text: 'text-sm',
    indicator: 'w-2.5 h-2.5 right-0 bottom-0',
    sizePx: 32,
  },
  md: {
    container: 'w-10 h-10',
    text: 'text-base',
    indicator: 'w-3 h-3 right-0 bottom-0',
    sizePx: 40,
  },
  lg: {
    container: 'w-14 h-14',
    text: 'text-lg',
    indicator: 'w-3.5 h-3.5 right-0 bottom-0',
    sizePx: 56,
  },
  xl: {
    container: 'w-20 h-20',
    text: 'text-2xl',
    indicator: 'w-4 h-4 right-1 bottom-1',
    sizePx: 80,
  },
  '2xl': {
    container: 'w-28 h-28',
    text: 'text-3xl',
    indicator: 'w-5 h-5 right-1 bottom-1',
    sizePx: 112,
  },
};

/** Generate consistent color from string */
function stringToColor(str: string): string {
  const colors = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#ec4899', // pink
    '#f43f5e', // rose
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#eab308', // yellow
    '#84cc16', // lime
    '#22c55e', // green
    '#10b981', // emerald
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#0ea5e9', // sky
    '#3b82f6', // blue
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length]!;
}

/** Get initials from name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0]!.substring(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Avatar component.
 *
 * @example
 * <Avatar src="https://example.com/avatar.jpg" size="lg" />
 * <Avatar fallback="John Doe" online />
 */
export function Avatar({
  src,
  alt,
  fallback,
  size = 'md',
  className,
  online,
  borderColor,
}: AvatarProps) {
  const config = sizeConfig[size];
  const initials = fallback ? getInitials(fallback) : '?';
  const bgColor = fallback ? stringToColor(fallback) : '#71717a';

  const [imageError, setImageError] = React.useState(false);

  const showImage = src && !imageError;

  return (
    <View className={cn('relative', className)}>
      <View
        className={cn(
          'rounded-full overflow-hidden items-center justify-center',
          config.container,
          borderColor && 'border-2'
        )}
        style={borderColor ? { borderColor } : undefined}
      >
        {showImage ? (
          <Image
            source={typeof src === 'string' ? { uri: src } : src}
            className="w-full h-full"
            resizeMode="cover"
            onError={() => setImageError(true)}
            accessibilityLabel={alt || fallback || 'Avatar'}
          />
        ) : (
          <View
            className="w-full h-full items-center justify-center"
            style={{ backgroundColor: bgColor }}
          >
            <Text className={cn('font-semibold text-white', config.text)}>
              {initials}
            </Text>
          </View>
        )}
      </View>

      {online !== undefined && (
        <View
          className={cn(
            'absolute rounded-full border-2 border-background',
            config.indicator,
            online ? 'bg-success' : 'bg-zinc-500'
          )}
        />
      )}
    </View>
  );
}

/** Avatar group for showing multiple avatars */
export function AvatarGroup({
  avatars,
  max = 4,
  size = 'md',
  className,
}: {
  avatars: Array<{ src?: string; fallback?: string }>;
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;
  const config = sizeConfig[size];

  return (
    <View className={cn('flex-row', className)}>
      {visible.map((avatar, index) => (
        <View
          key={index}
          style={{ marginLeft: index === 0 ? 0 : -config.sizePx * 0.25 }}
        >
          <Avatar
            src={avatar.src}
            fallback={avatar.fallback}
            size={size}
            borderColor="#0a0a0f"
          />
        </View>
      ))}

      {overflow > 0 && (
        <View
          className={cn(
            'rounded-full bg-zinc-700 items-center justify-center border-2 border-background',
            config.container
          )}
          style={{ marginLeft: -config.sizePx * 0.25 }}
        >
          <Text className={cn('font-semibold text-zinc-300', config.text)}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

export default Avatar;

