/**
 * MultiRating component
 *
 * Displays ratings from multiple sources.
 */

import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RatingBadge, type RatingData } from './RatingBadge';

interface MultiRatingProps {
  /** Array of ratings from different sources */
  ratings: RatingData[];
  /** Display variant */
  variant?: 'default' | 'compact';
  /** Maximum number of ratings to display */
  maxRatings?: number;
}

/**
 * Legacy star rating for TMDb-style single rating
 */
export function LegacyRating({ value }: { value: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(234, 179, 8, 0.2)',
        borderRadius: 6,
      }}
    >
      <Ionicons name="star" size={14} color="#facc15" />
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#facc15' }}>
        {value.toFixed(1)}
      </Text>
    </View>
  );
}

/**
 * MultiRating component
 */
export function MultiRating({ ratings, variant = 'default', maxRatings }: MultiRatingProps) {
  if (!ratings || ratings.length === 0) {
    return null;
  }

  const displayRatings = maxRatings ? ratings.slice(0, maxRatings) : ratings;
  const hasMore = maxRatings && ratings.length > maxRatings;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {displayRatings.map((rating) => (
        <RatingBadge key={rating.source} rating={rating} variant={variant} />
      ))}
      {hasMore && (
        <Text style={{ fontSize: 14, color: '#71717a', fontWeight: '500' }}>
          +{ratings.length - maxRatings} more
        </Text>
      )}
    </View>
  );
}

export default MultiRating;

