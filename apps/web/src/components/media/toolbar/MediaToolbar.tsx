/**
 * MediaToolbar component
 *
 * Unified toolbar for Movies/Shows pages with search, sort, filter,
 * view mode toggle icons, and pagination display.
 * Uses shared UI components for consistency.
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, type ViewStyle } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { usePreferencesStore, type MoviesViewMode, type ShowsViewMode } from '../../../stores/preferences';
import {
  FilterDropdown,
  Pagination,
  ViewModeToggle,
  type FilterOption,
  type ViewMode,
} from '../../ui';

export type { FilterOption };

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
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: pressed ? '#3f3f46' : '#27272a',
          borderWidth: 1,
          borderColor: '#3f3f46',
        })}
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
              minWidth: 180,
              backgroundColor: '#27272a',
              borderWidth: 1,
              borderColor: '#3f3f46',
              borderRadius: 8,
              overflow: 'hidden',
              zIndex: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 15,
              elevation: 10,
            } as ViewStyle}
          >
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor:
                    selected === option.value
                      ? '#10b981'
                      : pressed
                        ? '#3f3f46'
                        : 'transparent',
                })}
              >
                <Text
                  style={{
                    color: selected === option.value ? '#fff' : '#d4d4d8',
                    fontSize: 14,
                  }}
                >
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
  const setViewMode = mediaType === 'movies'
    ? (mode: ViewMode) => setMoviesViewMode(mode as MoviesViewMode)
    : (mode: ViewMode) => setShowsViewMode(mode as ShowsViewMode);

  const hasActiveFilters = selectedGenre || selectedYear || searchQuery;

  const handleClearFilters = useCallback(() => {
    onSearchChange('');
    onGenreChange(undefined);
    onYearChange(undefined);
  }, [onSearchChange, onGenreChange, onYearChange]);

  return (
    <View style={{ gap: 16, zIndex: 100 }}>
      {/* Main toolbar row */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, zIndex: 100 }}>
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
            onPress={handleClearFilters}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: '#71717a', fontSize: 14 }}>Clear filters</Text>
          </Pressable>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Pagination */}
        <Pagination
          total={total}
          offset={offset}
          limit={limit}
          onPageChange={onPageChange}
        />

        {/* View mode toggles */}
        <ViewModeToggle
          activeMode={viewMode}
          onModeChange={setViewMode}
        />
      </View>
    </View>
  );
}

export default MediaToolbar;
