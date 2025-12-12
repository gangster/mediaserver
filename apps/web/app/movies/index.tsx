/**
 * Movies browse page
 *
 * Premium browsing experience with multiple view modes,
 * search, filters, and pagination.
 * Adapted from forreel for React Native Web.
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Layout } from '../../src/components/layout';
import { useMovies, useMovieGenres, useMovieYears } from '@mediaserver/api-client';
import { usePreferencesStore } from '../../src/stores/preferences';
import {
  MovieCard,
  MovieCardSkeleton,
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
 * Calculate grid columns based on view mode
 */
function getGridColumns(viewMode: string): number {
  switch (viewMode) {
    case 'poster':
    case 'posterCard':
      return 8; // Many columns for poster view
    case 'thumb':
    case 'thumbCard':
      return 4; // Fewer columns for thumb view
    case 'list':
    case 'banner':
      return 1; // Single column
    default:
      return 6;
  }
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
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Parse sort
  const { sortBy, sortOrder } = parseSort(selectedSort);

  // Fetch movies
  const { data: moviesData, isLoading: moviesLoading } = useMovies({
    // Note: Add search/filter params when API supports them
    limit,
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

  // Paginate
  const paginatedItems = useMemo(
    () => filteredItems.slice(offset, offset + limit),
    [filteredItems, offset, limit]
  );

  // Format filter options
  const genreOptions: FilterOption[] = useMemo(
    () => genres?.map((g: { name: string; count: number }) => ({ value: g.name, label: g.name, count: g.count })) ?? [],
    [genres]
  );

  const yearOptions: FilterOption[] = useMemo(
    () => years?.map((y: { year: number; count: number }) => ({ value: String(y.year), label: String(y.year), count: y.count })) ?? [],
    [years]
  );

  // Handlers
  const handleItemClick = useCallback(
    (item: MovieItem) => {
      router.push(`/movies/${item.id}` as `/movies/${string}`);
    },
    [router]
  );

  const handleGenreChange = useCallback((genre: string | undefined) => {
    setSelectedGenre(genre);
    setOffset(0);
  }, []);

  const handleYearChange = useCallback((year: string | undefined) => {
    setSelectedYear(year);
    setOffset(0);
  }, []);

  const handleSortChange = useCallback((sort: string) => {
    setSelectedSort(sort);
    setOffset(0);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setOffset(0);
  }, []);

  const handlePageChange = useCallback((newOffset: number) => {
    setOffset(newOffset);
  }, []);

  // Get empty message based on filters
  const getEmptyMessage = () => {
    if (searchQuery) return `No movies found matching "${searchQuery}"`;
    if (selectedGenre || selectedYear) return 'No movies match the selected filters';
    return 'No movies in your library';
  };

  // Calculate grid layout
  const columns = getGridColumns(moviesViewMode);
  const isGridLayout = moviesViewMode !== 'list' && moviesViewMode !== 'banner';
  const gap = isGridLayout ? 16 : moviesViewMode === 'list' ? 4 : 16;

  return (
    <Layout>
      <ScrollView style={{ flex: 1, backgroundColor: '#18181b' }}>
        <View style={{ paddingHorizontal: 32, paddingVertical: 24 }}>
        {/* Header */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 30, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
              Movies
            </Text>
            {filteredItems.length > 0 && (
              <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
                {filteredItems.length} {filteredItems.length === 1 ? 'movie' : 'movies'} in your library
          </Text>
            )}
          </View>

          {/* Toolbar */}
          <View style={{ marginBottom: 24 }}>
            <MediaToolbar
              mediaType="movies"
              total={filteredItems.length}
              offset={offset}
              limit={limit}
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
          {moviesLoading && offset === 0 ? (
            <View
              style={
                isGridLayout
                  ? {
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap,
                    }
                  : { gap }
              }
            >
              {Array.from({ length: 12 }).map((_, i) => (
                  <View
                    key={i}
                  style={
                    isGridLayout
                      ? { width: `${100 / columns}%`, paddingRight: gap }
                      : { width: '100%' }
                  }
                  >
                  <MovieCardSkeleton variant={moviesViewMode} />
                </View>
              ))}
            </View>
          ) : paginatedItems.length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
              <Text style={{ color: '#a1a1aa', fontSize: 18 }}>{getEmptyMessage()}</Text>
                  </View>
          ) : (
                  <View
              style={
                isGridLayout
                  ? {
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap,
                    }
                  : { gap }
              }
            >
              {paginatedItems.map((item: MovieItem, index: number) => (
                <View
                  key={item.id}
                  style={
                    isGridLayout
                      ? { width: `${100 / columns}%`, paddingRight: gap }
                      : { width: '100%' }
                  }
                >
                  <MovieCard
                    item={item}
                    variant={moviesViewMode}
                    onClick={handleItemClick}
                    priority={index < 12}
                    />
                  </View>
                ))}
          </View>
          )}
        </View>
      </ScrollView>
    </Layout>
  );
}
