/**
 * Pagination component
 *
 * Pagination controls with prev/next buttons and item count display.
 * Adapted for React Native Web.
 */

import { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PaginationProps {
  /** Total number of items */
  total: number;
  /** Current page offset (0-based) */
  offset: number;
  /** Items per page */
  limit: number;
  /** Called when page changes */
  onPageChange: (offset: number) => void;
}

/**
 * Pagination with prev/next buttons
 */
export function Pagination({ total, offset, limit, onPageChange }: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const startItem = total > 0 ? offset + 1 : 0;
  const endItem = Math.min(offset + limit, total);

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handlePrevPage = useCallback(() => {
    if (canGoPrev) {
      onPageChange(Math.max(0, offset - limit));
    }
  }, [offset, limit, canGoPrev, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (canGoNext) {
      onPageChange(offset + limit);
    }
  }, [offset, limit, canGoNext, onPageChange]);

  if (total === 0) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {/* Previous button */}
      <Pressable
        onPress={handlePrevPage}
        disabled={!canGoPrev}
        style={({ pressed }) => ({
          padding: 6,
          borderRadius: 6,
          backgroundColor: pressed && canGoPrev ? '#3f3f46' : 'transparent',
          opacity: canGoPrev ? 1 : 0.3,
        })}
      >
        <Ionicons name="chevron-back" size={20} color="#a1a1aa" />
      </Pressable>

      {/* Count display */}
      <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
        {startItem}-{endItem} of {total}
      </Text>

      {/* Next button */}
      <Pressable
        onPress={handleNextPage}
        disabled={!canGoNext}
        style={({ pressed }) => ({
          padding: 6,
          borderRadius: 6,
          backgroundColor: pressed && canGoNext ? '#3f3f46' : 'transparent',
          opacity: canGoNext ? 1 : 0.3,
        })}
      >
        <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
      </Pressable>
    </View>
  );
}

export default Pagination;

