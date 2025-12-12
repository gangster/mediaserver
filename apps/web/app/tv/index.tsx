/**
 * TV Shows browse page
 *
 * Premium browsing experience with multiple view modes,
 * search, filters, and pagination.
 * Adapted from forreel for React Native Web.
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Layout } from '../../src/components/layout';
import { useShows } from '@mediaserver/api-client';
import { usePreferencesStore } from '../../src/stores/preferences';
import {
  ShowCard,
  ShowCardSkeleton,
  MediaToolbar,
  type ShowItem,
  type FilterOption,
} from '../../src/components/media';

/** Sort options for shows */
const sortOptions: FilterOption[] = [
  { value: 'addedAt-desc', label: 'Recently Added' },
  { value: 'title-asc', label: 'Title (A-Z)' },
  { value: 'title-desc', label: 'Title (Z-A)' },
  { value: 'year-desc', label: 'Year (Newest)' },
  { value: 'year-asc', label: 'Year (Oldest)' },
  { value: 'voteAverage-desc', label: 'Rating (Highest)' },
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
 * Transform API show to ShowItem
 */
function toShowItem(show: {
  id: string;
  title: string;
  year: number | null;
  lastAirDate?: string | null;
  status?: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number | null;
  overview: string | null;
  seasonCount?: number;
  episodeCount?: number;
  network?: string | null;
  unwatchedCount?: number;
  genres?: string[];
}): ShowItem {
  // Calculate end year from lastAirDate if available
  const endYear = show.lastAirDate ? new Date(show.lastAirDate).getFullYear() : null;

  return {
    id: show.id,
    title: show.title,
    year: show.year,
    endYear,
    status: show.status,
    posterPath: show.posterPath,
    backdropPath: show.backdropPath,
    voteAverage: show.voteAverage,
    overview: show.overview,
    seasonCount: show.seasonCount,
    episodeCount: show.episodeCount,
    network: show.network,
    unwatchedCount: show.unwatchedCount,
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
 * TV Shows browse page
 */
export default function TVShowsPage() {
  const router = useRouter();
  const { showsViewMode } = usePreferencesStore();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [selectedYear, setSelectedYear] = useState<string | undefined>();
  const [selectedSort, setSelectedSort] = useState('addedAt-desc');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Parse sort
  const { sortBy, sortOrder } = parseSort(selectedSort);

  // Fetch shows
  const { data: showsData, isLoading: showsLoading } = useShows({
    limit,
  });

  // Transform data
  const showItems: ShowItem[] = useMemo(
    () => showsData?.items?.map(toShowItem) ?? [],
    [showsData]
  );

  // Apply client-side filtering (until API supports these)
  const filteredItems: ShowItem[] = useMemo(() => {
    let items: ShowItem[] = showItems;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item: ShowItem) =>
          item.title.toLowerCase().includes(query) ||
          item.overview?.toLowerCase().includes(query)
      );
    }

    // Year filter
    if (selectedYear) {
      const yearNum = parseInt(selectedYear, 10);
      items = items.filter((item: ShowItem) => item.year === yearNum);
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
  }, [showItems, searchQuery, selectedYear, sortBy, sortOrder]);

  // Paginate
  const paginatedItems = useMemo(
    () => filteredItems.slice(offset, offset + limit),
    [filteredItems, offset, limit]
  );

  // For now, we don't have genre/year API endpoints for shows
  const genreOptions: FilterOption[] = [];
  const yearOptions: FilterOption[] = useMemo(() => {
    const yearsSet = new Set<number>();
    showItems.forEach((item: ShowItem) => {
      if (item.year) yearsSet.add(item.year);
    });
    return Array.from(yearsSet)
      .sort((a, b) => b - a)
      .map((year) => ({
        value: String(year),
        label: String(year),
      }));
  }, [showItems]);

  // Handlers
  const handleItemClick = useCallback(
    (item: ShowItem) => {
      router.push(`/tv/${item.id}` as `/tv/${string}`);
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
    if (searchQuery) return `No shows found for "${searchQuery}"`;
    if (selectedGenre || selectedYear) return 'No shows match your filters';
    return 'No TV shows in your library yet';
  };

  // Calculate grid layout
  const columns = getGridColumns(showsViewMode);
  const isGridLayout = showsViewMode !== 'list' && showsViewMode !== 'banner';
  const gap = isGridLayout ? 16 : showsViewMode === 'list' ? 4 : 16;

  return (
    <Layout>
      <ScrollView style={{ flex: 1, backgroundColor: '#09090b' }}>
        <View style={{ paddingHorizontal: 32, paddingVertical: 24 }}>
        {/* Header */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 30, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
            TV Shows
          </Text>
            {filteredItems.length > 0 && (
              <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
                {filteredItems.length} {filteredItems.length === 1 ? 'show' : 'shows'} in your library
          </Text>
            )}
          </View>

          {/* Toolbar */}
          <View style={{ marginBottom: 24 }}>
            <MediaToolbar
              mediaType="shows"
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

          {/* Shows grid */}
          {showsLoading && offset === 0 ? (
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
                  <ShowCardSkeleton variant={showsViewMode} />
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
              {paginatedItems.map((item: ShowItem, index: number) => (
                <View
                  key={item.id}
                  style={
                    isGridLayout
                      ? { width: `${100 / columns}%`, paddingRight: gap }
                      : { width: '100%' }
                  }
                >
                  <ShowCard
                    item={item}
                    variant={showsViewMode}
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
