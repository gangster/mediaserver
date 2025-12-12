/**
 * UnmatchedList - Displays unmatched media items with actions
 */

import React, { useState, useCallback } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '@mediaserver/ui';
import { Ionicons } from '@expo/vector-icons';
import { useUnmatchedItems, useRefreshMetadata } from '@mediaserver/api-client';
import { IdentifyModal } from './IdentifyModal';

interface UnmatchedItem {
  id: string;
  type: 'movie' | 'tvshow';
  title: string;
  year: number | null;
  filePath: string;
  posterPath: string | null;
}

interface UnmatchedListProps {
  libraryId?: string;
  type?: 'movie' | 'tvshow';
  onRefresh?: () => void;
}

export function UnmatchedList({ libraryId, type, onRefresh }: UnmatchedListProps) {
  const [selectedItem, setSelectedItem] = useState<UnmatchedItem | null>(null);

  const { data: items, isLoading, refetch } = useUnmatchedItems({ libraryId, type, limit: 50 });
  const refreshMutation = useRefreshMetadata();

  const handleIdentify = useCallback((item: UnmatchedItem) => {
    setSelectedItem(item);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleIdentified = useCallback(() => {
    refetch();
    onRefresh?.();
  }, [refetch, onRefresh]);

  const handleRetry = useCallback(async (item: UnmatchedItem) => {
    try {
      await refreshMutation.mutateAsync({
        type: item.type,
        itemId: item.id,
      });
      refetch();
    } catch (error) {
      console.error('Failed to retry:', error);
    }
  }, [refreshMutation, refetch]);

  if (isLoading) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  if (!items || items.length === 0) {
    return (
      <View style={{ padding: 40, alignItems: 'center', gap: 12 }}>
        <Ionicons name="checkmark-circle-outline" size={48} color="#22c55e" />
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>
          All items matched!
        </Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
          No unmatched items in this library
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={{ gap: 12 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="warning-outline" size={20} color="#eab308" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
              {items.length} Unmatched Item{items.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Item List */}
        <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ gap: 8 }}>
          {items.map((item: UnmatchedItem) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {/* Poster placeholder */}
              <View
                style={{
                  width: 60,
                  height: 90,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={item.type === 'movie' ? 'film-outline' : 'tv-outline'}
                  size={24}
                  color="rgba(255,255,255,0.3)"
                />
              </View>

              {/* Info */}
              <View style={{ flex: 1, padding: 12, gap: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                  {item.title}
                </Text>
                {item.year && (
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    {item.year}
                  </Text>
                )}
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}
                >
                  {item.filePath}
                </Text>
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8, gap: 4 }}>
                <Pressable
                  onPress={() => handleRetry(item)}
                  style={({ pressed }) => ({
                    padding: 8,
                    opacity: pressed ? 0.5 : 1,
                  })}
                >
                  <Ionicons name="refresh-outline" size={20} color="rgba(255,255,255,0.5)" />
                </Pressable>
                <Pressable
                  onPress={() => handleIdentify(item)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? 'rgba(229, 9, 20, 0.8)' : '#e50914',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 4,
                  })}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>
                    Identify
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <IdentifyModal
        isOpen={selectedItem !== null}
        onClose={handleCloseModal}
        item={selectedItem}
        onIdentified={handleIdentified}
      />
    </>
  );
}

