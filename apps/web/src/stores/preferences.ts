/**
 * UI Preferences store with Zustand
 *
 * Manages user-configurable UI settings for display and accessibility.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Available view modes for Shows page */
export type ShowsViewMode =
  | 'poster'
  | 'posterCard'
  | 'list'
  | 'thumb'
  | 'thumbCard'
  | 'banner';

/** Available view modes for Movies page */
export type MoviesViewMode =
  | 'poster'
  | 'posterCard'
  | 'list'
  | 'thumb'
  | 'thumbCard'
  | 'banner';

/** Home page section visibility preferences */
export interface HomePreferences {
  /** Show hero banner with featured content */
  showHeroBanner: boolean;
  /** Show continue watching section (movies + shows in progress) */
  showContinueWatching: boolean;
  /** Show recently added movies section */
  showRecentMovies: boolean;
  /** Show recently added shows section */
  showRecentShows: boolean;
  /** Show top rated content section */
  showTopRated: boolean;
  /** Show library statistics */
  showStats: boolean;
}

/** UI Preferences state */
export interface UIPreferences {
  /** Whether to show ratings on cards */
  showRatings: boolean;
  /** Whether to show progress bars on cards */
  showProgress: boolean;
  /** Number of items per row in grid layout */
  gridColumns: number;
  /** Reduce motion for accessibility */
  reduceMotion: boolean;
  /** View mode for Shows page */
  showsViewMode: ShowsViewMode;
  /** View mode for Movies page */
  moviesViewMode: MoviesViewMode;
  /** Home page section visibility preferences */
  homePreferences: HomePreferences;
  /** How to display cast and crew: 'combined' = single row, 'separate' = two rows */
  castCrewLayout: 'combined' | 'separate';
  /** Whether sidebar is collapsed (desktop only) */
  sidebarCollapsed: boolean;
}

/** Preferences actions */
interface PreferencesActions {
  /** Toggle ratings display */
  setShowRatings: (show: boolean) => void;
  /** Toggle progress display */
  setShowProgress: (show: boolean) => void;
  /** Set grid columns */
  setGridColumns: (columns: number) => void;
  /** Toggle reduce motion */
  setReduceMotion: (enabled: boolean) => void;
  /** Set shows view mode */
  setShowsViewMode: (mode: ShowsViewMode) => void;
  /** Set movies view mode */
  setMoviesViewMode: (mode: MoviesViewMode) => void;
  /** Update home page preferences */
  setHomePreferences: (prefs: Partial<HomePreferences>) => void;
  /** Set cast/crew layout mode */
  setCastCrewLayout: (layout: 'combined' | 'separate') => void;
  /** Set sidebar collapsed state */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Reset all preferences to defaults */
  resetToDefaults: () => void;
  /** Update multiple preferences at once */
  updatePreferences: (prefs: Partial<UIPreferences>) => void;
}

/** Combined preferences store */
type PreferencesStore = UIPreferences & PreferencesActions;

/** Default preferences */
const defaultPreferences: UIPreferences = {
  showRatings: true,
  showProgress: true,
  gridColumns: 6,
  reduceMotion: false,
  showsViewMode: 'posterCard',
  moviesViewMode: 'posterCard',
  homePreferences: {
    showHeroBanner: true,
    showContinueWatching: true,
    showRecentMovies: true,
    showRecentShows: true,
    showTopRated: true,
    showStats: true,
  },
  castCrewLayout: 'combined',
  sidebarCollapsed: false,
};

/**
 * Preferences store
 *
 * Persisted to localStorage under 'mediaserver-preferences'
 */
export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      // Default state
      ...defaultPreferences,

      // Actions
      setShowRatings: (show) => set({ showRatings: show }),

      setShowProgress: (show) => set({ showProgress: show }),

      setGridColumns: (columns) =>
        set({ gridColumns: Math.min(Math.max(columns, 2), 10) }),

      setReduceMotion: (enabled) => set({ reduceMotion: enabled }),

      setShowsViewMode: (mode) => set({ showsViewMode: mode }),

      setMoviesViewMode: (mode) => set({ moviesViewMode: mode }),

      setHomePreferences: (prefs) =>
        set((state) => ({
          homePreferences: { ...state.homePreferences, ...prefs },
        })),

      setCastCrewLayout: (layout) => set({ castCrewLayout: layout }),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      resetToDefaults: () => set(defaultPreferences),

      updatePreferences: (prefs) => set((state) => ({ ...state, ...prefs })),
    }),
    {
      name: 'mediaserver-preferences',
      version: 1,
      storage: createJSONStorage(() => {
        // SSR-safe localStorage access
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
    }
  )
);

/**
 * Hook to get current preferences (read-only)
 */
export function usePreferences(): UIPreferences {
  return usePreferencesStore((state) => ({
    showRatings: state.showRatings,
    showProgress: state.showProgress,
    gridColumns: state.gridColumns,
    reduceMotion: state.reduceMotion,
    showsViewMode: state.showsViewMode,
    moviesViewMode: state.moviesViewMode,
    homePreferences: state.homePreferences,
    castCrewLayout: state.castCrewLayout,
    sidebarCollapsed: state.sidebarCollapsed,
  }));
}

/** Shows view mode display names for UI */
export const showsViewModeNames: Record<ShowsViewMode, string> = {
  poster: 'Poster',
  posterCard: 'Poster Card',
  list: 'List',
  thumb: 'Thumb',
  thumbCard: 'Thumb Card',
  banner: 'Banner',
};

/** Movies view mode display names for UI */
export const moviesViewModeNames: Record<MoviesViewMode, string> = {
  poster: 'Poster',
  posterCard: 'Poster Card',
  list: 'List',
  thumb: 'Thumb',
  thumbCard: 'Thumb Card',
  banner: 'Banner',
};

/** Home section display names for UI */
export const homeSectionNames: Record<keyof HomePreferences, string> = {
  showHeroBanner: 'Hero Banner',
  showContinueWatching: 'Continue Watching',
  showRecentMovies: 'Recently Added Movies',
  showRecentShows: 'Recently Added Shows',
  showTopRated: 'Top Rated',
  showStats: 'Library Statistics',
};
