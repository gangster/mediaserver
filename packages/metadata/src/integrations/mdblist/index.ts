/**
 * MDBList Integration - Aggregated ratings from multiple sources
 *
 * Provides ratings from:
 * - IMDb
 * - Rotten Tomatoes (critics + audience)
 * - Metacritic
 * - Letterboxd
 * - Trakt
 * - TMDb
 */

import type { RatingsIntegration } from '../../interfaces/ratings.js';
import type { IntegrationConfig, AggregateRatings, RatingScore } from '../../types.js';
import { MdblistClient } from './client.js';
import { createMdblistConfig, type MdblistConfig } from './config.js';
import { MDBLIST_SOURCE_MAP, type MdblistRating } from './types.js';

export { MdblistClient } from './client.js';
export type { MdblistConfig } from './config.js';
export type { MdblistMediaResponse, MdblistRating } from './types.js';

/**
 * MDBList Integration - provides aggregated ratings from IMDb, RT, Metacritic, etc.
 */
export class MdblistIntegration implements RatingsIntegration {
  readonly id = 'mdblist';
  readonly name = 'MDBList';
  readonly description = 'Aggregated ratings from IMDb, Rotten Tomatoes, Metacritic, and more';
  readonly apiKeyUrl = 'https://mdblist.com/preferences/';
  readonly requiresApiKey = true;
  readonly usesOAuth = false;
  readonly providesMetadata = false; // Only provides ratings, not full metadata
  readonly supportsMovies = true;
  readonly supportsShows = true;
  readonly supportsAnime = false;
  readonly ratingSources = ['imdb', 'rt_critics', 'rt_audience', 'metacritic', 'letterboxd', 'trakt', 'tmdb'];

  private config: MdblistConfig | null = null;
  private client: MdblistClient | null = null;

  async initialize(config: IntegrationConfig): Promise<void> {
    // Don't initialize client if no API key - will be marked as not ready
    if (!config.apiKey) {
      return;
    }
    
    this.config = createMdblistConfig(config.apiKey, {
      cacheEnabled: config.options?.cacheEnabled as boolean ?? true,
      cacheTtl: config.options?.cacheTtl as number ?? 86400,
    });
    
    this.client = new MdblistClient(this.config);
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Not initialized' };
    }

    try {
      // Try looking up a well-known movie (The Shawshank Redemption)
      const result = await this.client.getByImdbId('tt0111161');
      if (result) {
        return { success: true };
      }
      return { success: false, error: 'Could not fetch test data' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  isReady(): boolean {
    return this.client !== null;
  }

  /**
   * Get aggregate ratings for a movie by IMDB ID
   */
  async getMovieRatings(imdbId: string): Promise<AggregateRatings> {
    if (!this.client) {
      throw new Error('MDBList not initialized');
    }

    const response = await this.client.getByImdbId(imdbId);
    if (!response?.ratings) {
      return {};
    }

    return this.mapRatings(response.ratings);
  }

  /**
   * Get aggregate ratings for a TV show by IMDB ID
   */
  async getShowRatings(imdbId: string): Promise<AggregateRatings> {
    if (!this.client) {
      throw new Error('MDBList not initialized');
    }

    const response = await this.client.getByImdbId(imdbId);
    if (!response?.ratings) {
      return {};
    }

    return this.mapRatings(response.ratings);
  }

  /**
   * Get ratings by TMDb ID (convenience method)
   */
  async getRatingsByTmdbId(tmdbId: number, type: 'movie' | 'show'): Promise<AggregateRatings> {
    if (!this.client) {
      throw new Error('MDBList not initialized');
    }

    const response = await this.client.getByTmdbId(tmdbId, type);
    if (!response?.ratings) {
      return {};
    }

    return this.mapRatings(response.ratings);
  }

  /**
   * Get the underlying client for advanced usage
   */
  getClient(): MdblistClient {
    if (!this.client) {
      throw new Error('MDBList not initialized');
    }
    return this.client;
  }

  /**
   * Map MDBList ratings to our AggregateRatings type
   */
  private mapRatings(mdblistRatings: MdblistRating[]): AggregateRatings {
    const ratings: AggregateRatings = {};

    for (const r of mdblistRatings) {
      const source = MDBLIST_SOURCE_MAP[r.source.toLowerCase()];
      if (!source) continue;

      // Skip ratings with null/undefined/NaN values
      if (r.value == null || Number.isNaN(r.value)) continue;

      const ratingScore: RatingScore = {
        score: r.value,
        voteCount: r.votes,
      };

      switch (source) {
        case 'imdb':
          ratings.imdb = ratingScore;
          break;
        case 'rt_critics':
          ratings.rottenTomatoesCritics = ratingScore;
          break;
        case 'rt_audience':
          ratings.rottenTomatoesAudience = ratingScore;
          break;
        case 'metacritic':
          ratings.metacritic = ratingScore;
          break;
        case 'letterboxd':
          ratings.letterboxd = ratingScore;
          break;
        case 'trakt':
          ratings.trakt = ratingScore;
          break;
        case 'tmdb':
          ratings.tmdb = ratingScore;
          break;
      }
    }

    return ratings;
  }
}

