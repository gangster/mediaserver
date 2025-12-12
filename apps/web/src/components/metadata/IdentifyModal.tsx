/**
 * IdentifyModal - Modal for manually identifying unmatched media items
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { Text } from '@mediaserver/ui';
import { Ionicons } from '@expo/vector-icons';
import {
  useMetadataSearch,
  useIdentifyMedia,
  type UseMetadataSearchOptions,
} from '@mediaserver/api-client';
import { useDebounce } from '../../hooks/useDebounce';

interface IdentifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    type: 'movie' | 'tvshow';
    title: string;
    year: number | null;
    filePath: string;
  } | null;
  onIdentified?: () => void;
}

interface SearchResult {
  integration: string;
  integrationId: string;
  title: string;
  originalTitle?: string;
  year?: number;
  releaseDate?: string;
  overview?: string;
  posterPath?: string;
  confidence: number;
}

const SERVER_URL = 'http://localhost:3000';

export function IdentifyModal({ isOpen, onClose, item, onIdentified }: IdentifyModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchYear, setSearchYear] = useState<string>('');
  const debouncedQuery = useDebounce(searchQuery, 300);

  const identifyMutation = useIdentifyMedia();

  // Set initial search query from item
  useEffect(() => {
    if (item) {
      setSearchQuery(item.title);
      setSearchYear(item.year?.toString() ?? '');
    }
  }, [item]);

  const searchOptions: UseMetadataSearchOptions = {
    query: debouncedQuery,
    type: item?.type ?? 'movie',
    year: searchYear ? parseInt(searchYear, 10) : undefined,
  };

  const { data: searchResults, isLoading, isFetching } = useMetadataSearch(
    searchOptions,
    isOpen && debouncedQuery.length > 0
  );

  const handleSelect = useCallback(async (result: SearchResult) => {
    if (!item) return;

    try {
      await identifyMutation.mutateAsync({
        type: item.type,
        itemId: item.id,
        integration: result.integration,
        externalId: result.integrationId,
      });

      onIdentified?.();
      onClose();
    } catch (error) {
      console.error('Failed to identify:', error);
    }
  }, [item, identifyMutation, onIdentified, onClose]);

  if (!isOpen || !item) return null;

  return (
    <View
      style={{
        position: 'fixed' as unknown as 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 100,
        justifyContent: 'center',
        alignItems: 'center',
      } as React.ComponentProps<typeof View>['style']}
    >
      <View
        style={{
          backgroundColor: '#1a1a2e',
          borderRadius: 12,
          width: '90%',
          maxWidth: 600,
          maxHeight: '80%',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>
              Identify {item.type === 'movie' ? 'Movie' : 'TV Show'}
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              {item.filePath}
            </Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Search Form */}
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Title</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search title..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: 12,
                color: '#fff',
                fontSize: 16,
              }}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Year (optional)</Text>
            <TextInput
              value={searchYear}
              onChangeText={setSearchYear}
              placeholder="Year..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="number-pad"
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: 12,
                color: '#fff',
                fontSize: 16,
                width: 120,
              }}
            />
          </View>
        </View>

        {/* Results */}
        <ScrollView
          style={{ flex: 1, maxHeight: 400 }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
        >
          {(isLoading || isFetching) && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#e50914" />
            </View>
          )}

          {!isLoading && !isFetching && searchResults?.length === 0 && debouncedQuery.length > 0 && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)' }}>No results found</Text>
            </View>
          )}

          {searchResults?.map((result: SearchResult) => (
            <Pressable
              key={`${result.integration}-${result.integrationId}`}
              onPress={() => handleSelect(result)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                borderRadius: 8,
                overflow: 'hidden',
              })}
            >
              {/* Poster */}
              {result.posterPath ? (
                <Image
                  source={{
                    uri: `${SERVER_URL}/api/images/poster/${result.posterPath.replace('/', '')}?size=small`,
                  }}
                  style={{ width: 80, height: 120 }}
                />
              ) : (
                <View
                  style={{
                    width: 80,
                    height: 120,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="film-outline" size={32} color="rgba(255,255,255,0.3)" />
                </View>
              )}

              {/* Info */}
              <View style={{ flex: 1, padding: 12, gap: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
                  {result.title}
                </Text>
                {result.year && (
                  <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                    {result.year}
                  </Text>
                )}
                {result.overview && (
                  <Text
                    numberOfLines={2}
                    style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}
                  >
                    {result.overview}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 'auto', gap: 8 }}>
                  <View
                    style={{
                      backgroundColor: result.confidence >= 0.85 ? '#22c55e' : result.confidence >= 0.5 ? '#eab308' : '#ef4444',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>
                      {Math.round(result.confidence * 100)}% match
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    via {result.integration.toUpperCase()}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

