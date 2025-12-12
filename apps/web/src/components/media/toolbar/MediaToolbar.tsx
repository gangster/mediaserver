/**
 * MediaToolbar component
 *
 * Unified toolbar for Movies/Shows pages with search, sort, filter,
 * view mode toggle icons, and pagination display.
 * Adapted from forreel for React Native Web.
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, type ViewStyle } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { usePreferencesStore, type MoviesViewMode, type ShowsViewMode } from '../../../stores/preferences';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface MediaToolbarProps {
  /** Type of media (movies or shows) */
  mediaType: 'movies' | 'shows';
  /** Total number of items */
  total: number;
  /** Current page offset */
  offset: number;
  /** Items per page */
  limit: number;
  /** Search query */
  searchQuery: string;
  /** Selected sort option */
  selectedSort: string;
  /** Available sort options */
  sortOptions: FilterOption[];
  /** Available genres */
  genres: FilterOption[];
  /** Available years */
  years: FilterOption[];
  /** Selected genre filter */
  selectedGenre?: string;
  /** Selected year filter */
  selectedYear?: string;
  /** Callbacks */
  onSearchChange: (query: string) => void;
  onSortChange: (sort: string) => void;
  onGenreChange: (genre: string | undefined) => void;
  onYearChange: (year: string | undefined) => void;
  onPageChange: (offset: number) => void;
}

type ViewMode = MoviesViewMode | ShowsViewMode;

/** View mode definitions */
const viewModeOrder: ViewMode[] = ['poster', 'posterCard', 'list', 'thumb', 'thumbCard', 'banner'];

/** View mode icon component */
function ViewModeIcon({ mode, color }: { mode: ViewMode; color: string }) {
  const size = 20;

  switch (mode) {
    case 'poster':
      return <Ionicons name="grid-outline" size={size} color={color} />;
    case 'posterCard':
      return <Ionicons name="albums-outline" size={size} color={color} />;
    case 'list':
      return <Feather name="list" size={size} color={color} />;
    case 'thumb':
      return <Ionicons name="apps-outline" size={size} color={color} />;
    case 'thumbCard':
      return <Ionicons name="layers-outline" size={size} color={color} />;
    case 'banner':
      return <Feather name="sidebar" size={size} color={color} style={{ transform: [{ rotate: '90deg' }] }} />;
    default:
      return <Ionicons name="grid-outline" size={size} color={color} />;
  }
}

/** Filter dropdown component */
function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  allLabel = 'All',
}: {
  label: string;
  options: FilterOption[];
  selected?: string;
  onChange: (value: string | undefined) => void;
  allLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const buttonStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: selected ? '#10b981' : '#27272a',
  };

  return (
    <View style={{ position: 'relative', zIndex: isOpen ? 100 : 1 }}>
      <Pressable onPress={() => setIsOpen(!isOpen)} style={buttonStyle}>
        <Text style={{ color: selected ? '#fff' : '#d4d4d8', fontSize: 14 }}>
          {selected || label}
        </Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={selected ? '#fff' : '#d4d4d8'}
        />
      </Pressable>

      {isOpen && (
        <>
          {/* Backdrop */}
          <Pressable
            onPress={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
            } as ViewStyle}
          />
          {/* Dropdown */}
          <View
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              width: 192,
              maxHeight: 256,
              backgroundColor: '#27272a',
              borderWidth: 1,
              borderColor: '#3f3f46',
              borderRadius: 8,
              overflow: 'hidden',
              zIndex: 20,
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            } as ViewStyle}
          >
            {/* All option */}
            <Pressable
              onPress={() => {
                onChange(undefined);
                setIsOpen(false);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: !selected ? '#10b981' : 'transparent',
              }}
            >
              <Text style={{ color: !selected ? '#fff' : '#d4d4d8', fontSize: 14 }}>{allLabel}</Text>
            </Pressable>
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: selected === option.value ? '#10b981' : 'transparent',
                }}
              >
                <Text style={{ color: selected === option.value ? '#fff' : '#d4d4d8', fontSize: 14 }}>
                  {option.label}
                </Text>
                {option.count !== undefined && (
                  <Text style={{ color: '#71717a', fontSize: 14 }}>{option.count}</Text>
                )}
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/** Sort dropdown component */
function SortDropdown({
  options,
  selected,
  onChange,
}: {
  options: FilterOption[];
  selected: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === selected);

  return (
    <View style={{ position: 'relative', zIndex: isOpen ? 100 : 1 }}>
      <Pressable
        onPress={() => setIsOpen(!isOpen)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: '#27272a',
          borderWidth: 1,
          borderColor: '#3f3f46',
        }}
      >
        <Text style={{ color: '#d4d4d8', fontSize: 14 }}>{selectedOption?.label || 'Sort'}</Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#d4d4d8" />
      </Pressable>

      {isOpen && (
        <>
          {/* Backdrop */}
          <Pressable
            onPress={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
            } as ViewStyle}
          />
          {/* Dropdown */}
          <View
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              width: 180,
              backgroundColor: '#27272a',
              borderWidth: 1,
              borderColor: '#3f3f46',
              borderRadius: 8,
              overflow: 'hidden',
              zIndex: 20,
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            } as ViewStyle}
          >
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: selected === option.value ? '#10b981' : 'transparent',
                }}
              >
                <Text style={{ color: selected === option.value ? '#fff' : '#d4d4d8', fontSize: 14 }}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/**
 * MediaToolbar component
 */
export function MediaToolbar({
  mediaType,
  total,
  offset,
  limit,
  searchQuery,
  selectedSort,
  sortOptions,
  genres,
  years,
  selectedGenre,
  selectedYear,
  onSearchChange,
  onSortChange,
  onGenreChange,
  onYearChange,
  onPageChange,
}: MediaToolbarProps) {
  const {
    moviesViewMode,
    showsViewMode,
    setMoviesViewMode,
    setShowsViewMode,
  } = usePreferencesStore();

  const viewMode = mediaType === 'movies' ? moviesViewMode : showsViewMode;
  const setViewMode = mediaType === 'movies' ? setMoviesViewMode : setShowsViewMode;

  // Calculate pagination
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const startItem = total > 0 ? offset + 1 : 0;
  const endItem = Math.min(offset + limit, total);

  const handlePrevPage = useCallback(() => {
    if (offset > 0) {
      onPageChange(Math.max(0, offset - limit));
    }
  }, [offset, limit, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (offset + limit < total) {
      onPageChange(offset + limit);
    }
  }, [offset, limit, total, onPageChange]);

  const hasActiveFilters = selectedGenre || selectedYear || searchQuery;

  return (
    <View style={{ gap: 16 }}>
      {/* Main toolbar row */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        {/* Search */}
        <View
          style={{
            flex: 1,
            minWidth: 200,
            maxWidth: 320,
            position: 'relative',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 12,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <Feather name="search" size={20} color="#71717a" />
          </View>
          <TextInput
            placeholder={`Search ${mediaType}...`}
            placeholderTextColor="#71717a"
            value={searchQuery}
            onChangeText={onSearchChange}
            style={{
              paddingLeft: 40,
              paddingRight: searchQuery ? 36 : 16,
              paddingVertical: 8,
              backgroundColor: '#27272a',
              borderWidth: 1,
              borderColor: '#3f3f46',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
            }}
          />
          {searchQuery && (
            <Pressable
              onPress={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: 12,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
              }}
            >
              <Feather name="x" size={16} color="#71717a" />
            </Pressable>
          )}
        </View>

        {/* Filter dropdowns */}
        <FilterDropdown
          label="Genre"
          options={genres}
          selected={selectedGenre}
          onChange={onGenreChange}
          allLabel="All Genres"
        />

        <FilterDropdown
          label="Year"
          options={years}
          selected={selectedYear}
          onChange={onYearChange}
          allLabel="All Years"
        />

        {/* Sort dropdown */}
        <SortDropdown options={sortOptions} selected={selectedSort} onChange={onSortChange} />

        {/* Clear filters */}
        {hasActiveFilters && (
          <Pressable
            onPress={() => {
              onSearchChange('');
              onGenreChange(undefined);
              onYearChange(undefined);
            }}
            style={{ paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <Text style={{ color: '#71717a', fontSize: 14 }}>Clear filters</Text>
          </Pressable>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Pagination info */}
        {total > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={handlePrevPage}
              disabled={currentPage === 1}
              style={{
                padding: 4,
                borderRadius: 4,
                opacity: currentPage === 1 ? 0.3 : 1,
              }}
            >
              <Feather name="chevron-left" size={20} color="#a1a1aa" />
            </Pressable>
            <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
              {startItem}-{endItem} of {total}
            </Text>
            <Pressable
              onPress={handleNextPage}
              disabled={currentPage === totalPages}
              style={{
                padding: 4,
                borderRadius: 4,
                opacity: currentPage === totalPages ? 0.3 : 1,
              }}
            >
              <Feather name="chevron-right" size={20} color="#a1a1aa" />
            </Pressable>
          </View>
        )}

        {/* View mode toggles */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            padding: 4,
            backgroundColor: '#27272a',
            borderRadius: 8,
          }}
        >
          {viewModeOrder.map((mode) => {
            const isActive = viewMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                style={{
                  padding: 8,
                  borderRadius: 4,
                  backgroundColor: isActive ? '#10b981' : 'transparent',
                }}
              >
                <ViewModeIcon mode={mode} color={isActive ? '#fff' : '#71717a'} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default MediaToolbar;
