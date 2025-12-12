/**
 * Interface for primary metadata integrations (TMDB, TVDB, AniDB, etc.)
 */

import type { BaseIntegration } from './base.js';
import type {
  SearchResult,
  MovieDetails,
  ShowDetails,
  SeasonDetails,
  EpisodeDetails,
} from '../types.js';

/**
 * Metadata integration interface
 * Implemented by integrations that provide primary metadata (TMDB, TVDB, AniDB, etc.)
 */
export interface MetadataIntegration extends BaseIntegration {
  /**
   * Search for movies by title and optional year
   */
  searchMovies(query: string, year?: number): Promise<SearchResult[]>;
  
  /**
   * Search for TV shows by title and optional year
   */
  searchShows(query: string, year?: number): Promise<SearchResult[]>;
  
  /**
   * Get detailed movie information by integration-specific ID
   */
  getMovieDetails(integrationId: string): Promise<MovieDetails>;
  
  /**
   * Get detailed TV show information by integration-specific ID
   */
  getShowDetails(integrationId: string): Promise<ShowDetails>;
  
  /**
   * Get season details including episodes
   */
  getSeasonDetails(showId: string, seasonNumber: number): Promise<SeasonDetails>;
  
  /**
   * Get episode details
   */
  getEpisodeDetails(
    showId: string,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<EpisodeDetails>;
}

/**
 * Type guard to check if an integration is a MetadataIntegration
 */
export function isMetadataIntegration(
  integration: BaseIntegration
): integration is MetadataIntegration {
  return (
    'searchMovies' in integration &&
    'searchShows' in integration &&
    'getMovieDetails' in integration &&
    'getShowDetails' in integration
  );
}

