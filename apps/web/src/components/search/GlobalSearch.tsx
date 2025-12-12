/**
 * GlobalSearch command palette component
 *
 * A Netflix/Spotlight-style search overlay with keyboard navigation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, TextInput, Image, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSearch } from '@mediaserver/api-client';
import { useDebounce } from '../../hooks';

/** Breakpoint for showing keyboard hints */
const SM_BREAKPOINT = 640;

export interface GlobalSearchProps {
  /** Whether the search modal is open */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
}

type SearchResultType = 'movie' | 'show' | 'episode';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  posterPath: string | null;
  showId?: string | null;
}

/**
 * Get image URL for poster
 */
function getImageUrl(result: SearchResult): string {
  if (!result.posterPath) {
    return '';
  }
  // For episodes, use the showId to fetch the show's poster
  if (result.type === 'episode' && result.showId) {
    return `http://localhost:3000/api/images/shows/${result.showId}/poster?size=small`;
  }
  const endpoint = result.type === 'movie' ? 'movies' : 'shows';
  return `http://localhost:3000/api/images/${endpoint}/${result.id}/poster?size=small`;
}

/**
 * Search result item component
 */
function SearchResultItem({
  result,
  isSelected,
  onPress,
  onHover,
}: {
  result: SearchResult;
  isSelected: boolean;
  onPress: () => void;
  onHover: () => void;
}) {
  const imageUrl = getImageUrl(result);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHover}
      className={`w-full flex flex-row items-center gap-3 p-3 rounded-lg ${
        isSelected ? 'bg-zinc-700' : 'hover:bg-zinc-800'
      }`}
    >
      {/* Poster or placeholder */}
      <View className="w-10 h-14 rounded bg-zinc-800 overflow-hidden">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
          </View>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 min-w-0">
        <Text className="text-white font-medium" numberOfLines={1}>
          {result.title}
        </Text>
        {result.subtitle && (
          <Text className="text-sm text-zinc-400" numberOfLines={1}>
            {result.subtitle}
          </Text>
        )}
      </View>

      {/* Type badge */}
      <View
        className={`px-2 py-1 rounded-full ${
          result.type === 'movie'
            ? 'bg-indigo-600/20'
            : result.type === 'show'
              ? 'bg-purple-600/20'
              : 'bg-emerald-600/20'
        }`}
      >
        <Text
          className={`text-xs ${
            result.type === 'movie'
              ? 'text-indigo-400'
              : result.type === 'show'
                ? 'text-purple-400'
                : 'text-emerald-400'
          }`}
        >
          {result.type === 'movie'
            ? 'Movie'
            : result.type === 'show'
              ? 'Show'
              : 'Episode'}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * GlobalSearch component
 */
export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debouncedQuery = useDebounce(query, 200);
  const showKeyboardHints = width >= SM_BREAKPOINT;
  const modalTopPadding = height * 0.15; // 15vh

  // Fetch search results
  const { data, isLoading } = useSearch(
    { query: debouncedQuery, limit: 8 },
    debouncedQuery.length > 0
  );

  // Transform results
  const results: SearchResult[] = (data?.results ?? []).map((item: { id: string; type: string; title: string; subtitle?: string | null; posterPath?: string | null; showId?: string | null }) => ({
    id: item.id,
    type: item.type as SearchResultType,
    title: item.title,
    subtitle: item.subtitle ?? null,
    posterPath: item.posterPath ?? null,
    showId: item.showId ?? null,
  }));

  // Navigate to result
  const navigateToResult = useCallback(
    (result: SearchResult) => {
      let path = '';
      switch (result.type) {
        case 'movie':
          path = `/movies/${result.id}`;
          break;
        case 'show':
          path = `/tv/${result.id}`;
          break;
        case 'episode':
          path = `/tv/${result.showId}/episode/${result.id}`;
          break;
      }
      router.push(path as '/movies/[id]');
      onClose();
    },
    [router, onClose]
  );

  // Handle keyboard navigation (called from TextInput onKeyPress)
  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string } }) => {
      const key = e.nativeEvent.key;
      switch (key) {
        case 'ArrowDown':
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          if (results[selectedIndex]) {
            navigateToResult(results[selectedIndex]);
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    },
    [results, selectedIndex, navigateToResult, onClose]
  );

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <View
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: modalTopPadding,
      }}
    >
      {/* Backdrop with blur */}
      <Pressable
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
        } as const}
      />

      {/* Modal */}
      <View
        style={{
          width: '100%',
          maxWidth: 640,
          marginHorizontal: 16,
          backgroundColor: 'rgba(39, 39, 42, 0.95)',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(63, 63, 70, 0.5)',
          overflow: 'hidden',
          zIndex: 51,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        } as const}
      >
        {/* Search input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(63, 63, 70, 0.5)',
            gap: 12,
          }}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a1a1aa"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onKeyPress={handleKeyPress}
            placeholder="Search movies, shows, and episodes..."
            placeholderTextColor="#71717a"
            style={{
              flex: 1,
              fontSize: 16,
              color: '#ffffff',
              // @ts-expect-error - outlineStyle works on web
              outlineStyle: 'none',
            } as const}
            autoComplete="off"
            autoCorrect={false}
          />
          {showKeyboardHints && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: 'rgba(63, 63, 70, 0.5)',
                borderRadius: 6,
                borderWidth: 1,
                borderColor: 'rgba(82, 82, 91, 0.5)',
              }}
            >
              <Text style={{ fontSize: 12, color: '#71717a' }}>ESC</Text>
            </View>
          )}
        </View>

        {/* Results */}
        <ScrollView style={{ maxHeight: 400 }}>
          {query.length === 0 ? (
            <View
              style={{
                paddingVertical: 48,
                paddingHorizontal: 32,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  marginBottom: 16,
                  borderRadius: 24,
                  backgroundColor: 'rgba(63, 63, 70, 0.5)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#52525b"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </View>
              <Text style={{ fontSize: 15, color: '#a1a1aa', marginBottom: 4 }}>
                Start typing to search...
              </Text>
              <Text style={{ fontSize: 13, color: '#71717a' }}>
                Search across movies, TV shows, and episodes
              </Text>
            </View>
          ) : isLoading ? (
            <View style={{ padding: 16, gap: 8 }}>
              {[...Array(3)].map((_, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 56,
                      borderRadius: 6,
                      backgroundColor: 'rgba(63, 63, 70, 0.5)',
                    }}
                  />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View
                      style={{
                        height: 16,
                        width: 128,
                        borderRadius: 4,
                        backgroundColor: 'rgba(63, 63, 70, 0.5)',
                      }}
                    />
                    <View
                      style={{
                        height: 12,
                        width: 96,
                        borderRadius: 4,
                        backgroundColor: 'rgba(63, 63, 70, 0.5)',
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : results.length === 0 ? (
            <View
              style={{
                paddingVertical: 48,
                paddingHorizontal: 32,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  marginBottom: 16,
                  borderRadius: 24,
                  backgroundColor: 'rgba(63, 63, 70, 0.5)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#52525b"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </View>
              <Text style={{ fontSize: 15, color: '#a1a1aa', marginBottom: 4 }}>
                No results found
              </Text>
              <Text style={{ fontSize: 13, color: '#71717a' }}>
                Try different keywords or check your spelling
              </Text>
            </View>
          ) : (
            <View style={{ padding: 8 }}>
              {results.map((result, index) => (
                <SearchResultItem
                  key={`${result.type}-${result.id}`}
                  result={result}
                  isSelected={index === selectedIndex}
                  onPress={() => navigateToResult(result)}
                  onHover={() => setSelectedIndex(index)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Footer with keyboard hints - hidden on mobile */}
        {results.length > 0 && showKeyboardHints && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: 'rgba(63, 63, 70, 0.5)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    backgroundColor: 'rgba(63, 63, 70, 0.5)',
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#71717a' }}>↑</Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    backgroundColor: 'rgba(63, 63, 70, 0.5)',
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#71717a' }}>↓</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#71717a', marginLeft: 4 }}>
                  Navigate
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    backgroundColor: 'rgba(63, 63, 70, 0.5)',
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#71717a' }}>↵</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#71717a', marginLeft: 4 }}>
                  Open
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: '#71717a' }}>
              {results.length} results
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default GlobalSearch;
