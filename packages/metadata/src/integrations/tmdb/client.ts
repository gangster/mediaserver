/**
 * TMDB API client with rate limiting and retry logic
 */

import { RateLimiterMemory } from 'rate-limiter-flexible';
import type {
  TmdbSearchMovieResponse,
  TmdbSearchTvResponse,
  TmdbMovieDetails,
  TmdbTvDetails,
  TmdbSeasonDetails,
  TmdbEpisode,
} from './types.js';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';

/**
 * Error thrown when TMDB API rate limit is exceeded
 */
export class TmdbRateLimitError extends Error {
  constructor(public retryAfter?: number) {
    super('TMDB rate limit exceeded');
    this.name = 'TmdbRateLimitError';
  }
}

/**
 * Error thrown when TMDB API returns an error
 */
export class TmdbApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'TmdbApiError';
  }
}

/**
 * TMDB client configuration
 */
export interface TmdbClientConfig {
  apiKey: string;
  language?: string;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * TMDB API client
 */
export class TmdbClient {
  private apiKey: string;
  private language: string;
  private maxRetries: number;
  private retryDelay: number;
  private rateLimiter: RateLimiterMemory;

  constructor(config: TmdbClientConfig) {
    this.apiKey = config.apiKey;
    this.language = config.language ?? 'en-US';
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;

    // TMDB allows 40 requests per 10 seconds
    this.rateLimiter = new RateLimiterMemory({
      points: 40,
      duration: 10,
    });
  }

  /**
   * Make a request to the TMDB API with rate limiting and retry logic
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    // Wait for rate limiter
    await this.rateLimiter.consume(1);

    const url = new URL(`${TMDB_API_BASE}${endpoint}`);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('language', this.language);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString());

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') ?? '10', 10);
          throw new TmdbRateLimitError(retryAfter);
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new TmdbApiError(
            response.status,
            `TMDB API error: ${response.status} - ${errorBody}`
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on non-retryable errors
        if (error instanceof TmdbApiError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
          throw error;
        }

        // Wait before retrying
        if (attempt < this.maxRetries) {
          const delay = error instanceof TmdbRateLimitError
            ? (error.retryAfter ?? 10) * 1000
            : this.retryDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('Unknown error');
  }

  /**
   * Search for movies
   */
  async searchMovies(
    query: string,
    options: { year?: number; page?: number } = {}
  ): Promise<TmdbSearchMovieResponse> {
    return this.request<TmdbSearchMovieResponse>('/search/movie', {
      query,
      year: options.year,
      page: options.page ?? 1,
      include_adult: 'false',
    });
  }

  /**
   * Search for TV shows
   */
  async searchTv(
    query: string,
    options: { firstAirDateYear?: number; page?: number } = {}
  ): Promise<TmdbSearchTvResponse> {
    return this.request<TmdbSearchTvResponse>('/search/tv', {
      query,
      first_air_date_year: options.firstAirDateYear,
      page: options.page ?? 1,
    });
  }

  /**
   * Get movie details with appended responses
   */
  async getMovieDetails(movieId: number): Promise<TmdbMovieDetails> {
    return this.request<TmdbMovieDetails>(`/movie/${movieId}`, {
      append_to_response: 'credits,release_dates,videos,external_ids,images',
    });
  }

  /**
   * Get TV show details with appended responses
   */
  async getTvDetails(tvId: number): Promise<TmdbTvDetails> {
    return this.request<TmdbTvDetails>(`/tv/${tvId}`, {
      append_to_response: 'credits,content_ratings,videos,external_ids,images',
    });
  }

  /**
   * Get season details
   */
  async getSeasonDetails(tvId: number, seasonNumber: number): Promise<TmdbSeasonDetails> {
    return this.request<TmdbSeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`, {
      append_to_response: 'external_ids',
    });
  }

  /**
   * Get episode details
   */
  async getEpisodeDetails(
    tvId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<TmdbEpisode> {
    return this.request<TmdbEpisode>(
      `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`
    );
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to get configuration to test the API key
      await this.request<{ images: unknown }>('/configuration');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update language setting
   */
  setLanguage(language: string): void {
    this.language = language;
  }
}


