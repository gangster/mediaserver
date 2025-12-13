/**
 * RatingBadge component
 *
 * Displays a rating score with icon and label.
 */

import { View, Text } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

/** Rating source types */
export type RatingSource = 'imdb' | 'rt_critics' | 'rt_audience' | 'metacritic' | 'tmdb' | 'letterboxd' | 'trakt';

/** Rating data structure */
export interface RatingData {
  source: RatingSource;
  score: number;
  scoreNormalized: number;
  scoreFormatted: string;
  voteCount?: number;
  updatedAt?: string;
}

interface RatingBadgeProps {
  /** Rating data */
  rating: RatingData;
  /** Display size variant */
  variant?: 'default' | 'compact';
}

/**
 * Get icon and colors for each rating source
 */
function getRatingStyle(source: RatingSource | string) {
  switch (source) {
    case 'imdb':
      return {
        icon: 'film' as const,
        iconSet: 'ionicons' as const,
        bgColor: 'rgba(245, 197, 24, 0.15)',
        borderColor: 'rgba(245, 197, 24, 0.3)',
        textColor: '#f5c518',
        label: 'IMDb',
      };
    case 'rt_critics':
      return {
        icon: 'tomato' as const,
        iconSet: 'material-community' as const,
        bgColor: 'rgba(250, 50, 10, 0.15)',
        borderColor: 'rgba(250, 50, 10, 0.3)',
        textColor: '#fa320a',
        label: 'Critics',
      };
    case 'rt_audience':
      return {
        icon: 'popcorn' as const,
        iconSet: 'material-community' as const,
        bgColor: 'rgba(250, 50, 10, 0.15)',
        borderColor: 'rgba(250, 50, 10, 0.3)',
        textColor: '#f77b6e',
        label: 'Audience',
      };
    case 'metacritic':
      return {
        icon: 'checkbox-blank-circle' as const,
        iconSet: 'material-community' as const,
        bgColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        textColor: '#10b981',
        label: 'Metacritic',
      };
    case 'tmdb':
      return {
        icon: 'star' as const,
        iconSet: 'ionicons' as const,
        bgColor: 'rgba(6, 182, 212, 0.15)',
        borderColor: 'rgba(6, 182, 212, 0.3)',
        textColor: '#06b6d4',
        label: 'TMDb',
      };
    case 'letterboxd':
      return {
        icon: 'ellipse' as const,
        iconSet: 'ionicons' as const,
        bgColor: 'rgba(249, 115, 22, 0.15)',
        borderColor: 'rgba(249, 115, 22, 0.3)',
        textColor: '#f97316',
        label: 'Letterboxd',
      };
    case 'trakt':
      return {
        icon: 'checkmark-circle' as const,
        iconSet: 'ionicons' as const,
        bgColor: 'rgba(225, 29, 72, 0.15)',
        borderColor: 'rgba(225, 29, 72, 0.3)',
        textColor: '#e11d48',
        label: 'Trakt',
      };
    default:
      return {
        icon: 'star' as const,
        iconSet: 'ionicons' as const,
        bgColor: 'rgba(161, 161, 170, 0.15)',
        borderColor: 'rgba(161, 161, 170, 0.3)',
        textColor: '#a1a1aa',
        label: source,
      };
  }
}

/**
 * Icon component that supports both Ionicons and MaterialCommunityIcons
 */
function RatingIcon({
  iconSet,
  icon,
  color,
  size,
}: {
  iconSet: 'ionicons' | 'material-community';
  icon: string;
  color: string;
  size: number;
}) {
  if (iconSet === 'material-community') {
    return <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={size} color={color} />;
  }
  return <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={size} color={color} />;
}

/**
 * RatingBadge component - compact pill design matching forreel
 */
export function RatingBadge({ rating, variant = 'default' }: RatingBadgeProps) {
  const style = getRatingStyle(rating.source);
  const isCompact = variant === 'compact';

  // Compact pill design - icon, score, label all inline
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: isCompact ? 4 : 6,
        paddingHorizontal: isCompact ? 8 : 10,
        paddingVertical: isCompact ? 3 : 5,
        backgroundColor: style.bgColor,
        borderWidth: 1,
        borderColor: style.borderColor,
        borderRadius: 999,
      }}
    >
      <RatingIcon iconSet={style.iconSet} icon={style.icon} color={style.textColor} size={isCompact ? 12 : 14} />
      <Text style={{ fontSize: isCompact ? 11 : 13, fontWeight: '700', color: style.textColor }}>
        {rating.scoreFormatted}
      </Text>
      <Text style={{ fontSize: isCompact ? 9 : 11, fontWeight: '500', color: style.textColor, opacity: 0.8 }}>
        {style.label}
      </Text>
    </View>
  );
}

export default RatingBadge;

