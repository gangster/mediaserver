/**
 * Movies browse page
 *
 * Premium browsing experience with infinite scroll, multiple view modes,
 * search, filters, and smooth animations.
 * Adapted from forreel for React Native Web.
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Layout } from '../../src/components/layout';
import { useMovies, useMovieGenres, useMovieYears } from '@mediaserver/api-client';
import { usePreferencesStore } from '../../src/stores/preferences';
import {
  BrowseMediaGrid as MediaGrid,
  MediaToolbar,
  type MovieItem,
  type FilterOption,
} from '../../src/components/media';

/** Sort options for movies */
const sortOptions: FilterOption[] = [
  { value: 'addedAt-desc', label: 'Recently Added' },
  { value: 'title-asc', label: 'Title (A-Z)' },
  { value: 'title-desc', label: 'Title (Z-A)' },
  { value: 'year-desc', label: 'Year (Newest)' },
  { value: 'year-asc', label: 'Year (Oldest)' },
  { value: 'voteAverage-desc', label: 'Highest Rated' },
  { value: 'voteAverage-asc', label: 'Lowest Rated' },
];

/**
 * Parse sort string into sortBy and sortOrder
 */
function parseSort(sortString: string): { sortBy: string; sortOrder: 'asc' | 'desc' } {
  const [sortBy, sortOrder] = sortString.split('-');
  return {
    sortBy: sortBy || 'addedAt',
    sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
  };
}

/**
 * Transform API movie to MovieItem
 */
function toMovieItem(movie: {
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number | null;
  overview: string | null;
  runtime?: number | null;
  genres?: string[];
  progress?: { percentage: number; isWatched: boolean } | null;
}): MovieItem {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year,
    posterPath: movie.posterPath,
    backdropPath: movie.backdropPath,
    voteAverage: movie.voteAverage,
    overview: movie.overview,
    runtime: movie.runtime ?? null,
    genres: movie.genres ?? [],
    progress: movie.progress?.percentage ?? null,
    isWatched: movie.progress?.isWatched ?? false,
  };
}

/**
 * Movies browse page
 */
export default function MoviesPage() {
  const router = useRouter();
  const { moviesViewMode } = usePreferencesStore();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [selectedYear, setSelectedYear] = useState<string | undefined>();
  const [selectedSort, setSelectedSort] = useState('addedAt-desc');

  // Parse sort
  const { sortBy, sortOrder } = parseSort(selectedSort);

  // Fetch all movies (client-side filtering for now)
  const { data: moviesData, isLoading: moviesLoading } = useMovies({
    limit: 100, // Server max limit is 100
  });

  // Fetch genres for filtering
  const { data: genres } = useMovieGenres();

  // Fetch years for filtering
  const { data: years } = useMovieYears();

  // Transform data
  const movieItems: MovieItem[] = useMemo(
    () => moviesData?.items?.map(toMovieItem) ?? [],
    [moviesData]
  );

  // Apply client-side filtering (until API supports these)
  const filteredItems: MovieItem[] = useMemo(() => {
    let items: MovieItem[] = movieItems;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item: MovieItem) =>
          item.title.toLowerCase().includes(query) ||
          item.overview?.toLowerCase().includes(query)
      );
    }

    // Genre filter
    if (selectedGenre) {
      items = items.filter((item: MovieItem) => item.genres?.includes(selectedGenre));
    }

    // Year filter
    if (selectedYear) {
      const yearNum = parseInt(selectedYear, 10);
      items = items.filter((item: MovieItem) => item.year === yearNum);
    }

    // Sort
    items = [...items].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'year':
          comparison = (a.year ?? 0) - (b.year ?? 0);
          break;
        case 'voteAverage':
          comparison = (a.voteAverage ?? 0) - (b.voteAverage ?? 0);
          break;
        default: // addedAt - keep original order
          return 0;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return items;
  }, [movieItems, searchQuery, selectedGenre, selectedYear, sortBy, sortOrder]);

  // Format filter options - server returns plain arrays (strings for genres, numbers for years)
  const genreOptions: FilterOption[] = useMemo(
    () => genres?.map((g: string) => ({ value: g, label: g })) ?? [],
    [genres]
  );

  const yearOptions: FilterOption[] = useMemo(
    () => years?.map((y: number) => ({ value: String(y), label: String(y) })) ?? [],
    [years]
  );

  // Total count
  const total = moviesData?.total ?? 0;

  // Handlers
  const handleItemClick = useCallback(
    (item: MovieItem) => {
      router.push(`/movies/${item.id}` as `/movies/${string}`);
    },
    [router]
  );

  const handleGenreChange = useCallback((genre: string | undefined) => {
    setSelectedGenre(genre);
  }, []);

  const handleYearChange = useCallback((year: string | undefined) => {
    setSelectedYear(year);
  }, []);

  const handleSortChange = useCallback((sort: string) => {
    setSelectedSort(sort);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Page change handler (for pagination display - scrolls to top)
  const handlePageChange = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Get empty message based on filters
  const getEmptyMessage = useCallback(() => {
    if (searchQuery) return `No movies found matching "${searchQuery}"`;
    if (selectedGenre || selectedYear) return 'No movies match the selected filters';
    return 'No movies in your library';
  }, [searchQuery, selectedGenre, selectedYear]);

  return (
    <Layout>
      <ScrollView style={{ flex: 1, backgroundColor: '#18181b' }}>
        <View style={{ paddingHorizontal: 32, paddingVertical: 24 }}>
          {/* Header */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 30, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
              Movies
            </Text>
            {total > 0 && (
              <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
                {total} {total === 1 ? 'movie' : 'movies'} in your library
              </Text>
            )}
          </View>

          {/* Toolbar */}
          <View style={{ marginBottom: 24, zIndex: 100 }}>
            <MediaToolbar
              mediaType="movies"
              total={filteredItems.length}
              offset={0}
              limit={filteredItems.length}
              searchQuery={searchQuery}
              selectedSort={selectedSort}
              sortOptions={sortOptions}
              genres={genreOptions}
              years={yearOptions}
              selectedGenre={selectedGenre}
              selectedYear={selectedYear}
              onSearchChange={handleSearchChange}
              onSortChange={handleSortChange}
              onGenreChange={handleGenreChange}
              onYearChange={handleYearChange}
              onPageChange={handlePageChange}
            />
          </View>

          {/* Movies grid */}
          <MediaGrid
            mediaType="movies"
            items={filteredItems}
            viewMode={moviesViewMode}
            isLoading={moviesLoading}
            onItemClick={handleItemClick}
            emptyMessage={getEmptyMessage()}
            skeletonCount={moviesViewMode === 'list' || moviesViewMode === 'banner' ? 6 : 12}
          />
        </View>
      </ScrollView>
    </Layout>
  );
}
