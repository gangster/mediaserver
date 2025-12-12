/**
 * TVDb API v4 client
 *
 * TVDb (TheTVDB) is particularly strong for:
 * - TV series episode data
 * - Anime metadata
 * - International TV content
 */

import { ExternalServiceError, withRetry, EXTERNAL_SERVICE_RETRY } from '@mediaserver/core';
import type { TvdbConfig } from './config.js';
import type {
  TvdbSearchResult,
  TvdbSeries,
  TvdbEpisode,
  TvdbSeason,
  TvdbRemoteId,
  TvdbResponse,
} from './types.js';
import { REMOTE_ID_TYPES } from './types.js';

/**
 * TVDb API v4 client with token authentication
 */
export class TvdbClient {
  private config: TvdbConfig;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: TvdbConfig) {
    this.config = config;
  }

  /**
   * Authenticate and get bearer token
   */
  async login(): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apikey: this.config.apiKey,
        ...(this.config.pin && { pin: this.config.pin }),
      }),
    });

    if (!response.ok) {
      throw new ExternalServiceError('TVDb', `Login failed: ${response.status}`);
    }

    const data = (await response.json()) as TvdbResponse<{ token: string }>;
    this.token = data.data.token;
    // Token is valid for 1 month, refresh after 29 days
    this.tokenExpiry = Date.now() + 29 * 24 * 60 * 60 * 1000;
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureToken(): Promise<string> {
    if (!this.token || Date.now() >= this.tokenExpiry) {
      await this.login();
    }
    return this.token!;
  }

  /**
   * Search for series
   */
  async search(query: string, type?: 'series' | 'movie'): Promise<TvdbSearchResult[]> {
    const params = new URLSearchParams({ query });
    if (type) {
      params.set('type', type);
    }

    const response = await this.request<TvdbSearchResult[]>(`/search?${params}`);
    return response ?? [];
  }

  /**
   * Search by IMDb ID
   */
  async searchByImdbId(imdbId: string): Promise<TvdbSearchResult[]> {
    const response = await this.request<TvdbSearchResult[]>(`/search?remote_id=${imdbId}`);
    return response ?? [];
  }

  /**
   * Get series by ID
   */
  async getSeries(id: number): Promise<TvdbSeries | null> {
    return this.request<TvdbSeries>(`/series/${id}/extended`);
  }

  /**
   * Get series by slug
   */
  async getSeriesBySlug(slug: string): Promise<TvdbSeries | null> {
    return this.request<TvdbSeries>(`/series/slug/${slug}`);
  }

  /**
   * Get all episodes for a series
   */
  async getSeriesEpisodes(
    seriesId: number,
    seasonType: 'default' | 'official' | 'dvd' | 'absolute' = 'default'
  ): Promise<TvdbEpisode[]> {
    const response = await this.request<{ episodes: TvdbEpisode[] }>(
      `/series/${seriesId}/episodes/${seasonType}`
    );
    return response?.episodes ?? [];
  }

  /**
   * Get seasons for a series
   */
  async getSeriesSeasons(seriesId: number): Promise<TvdbSeason[]> {
    const response = await this.request<{ seasons: TvdbSeason[] }>(
      `/series/${seriesId}/extended`
    );
    return response?.seasons ?? [];
  }

  /**
   * Get a specific episode
   */
  async getEpisode(episodeId: number): Promise<TvdbEpisode | null> {
    return this.request<TvdbEpisode>(`/episodes/${episodeId}/extended`);
  }

  /**
   * Extract IMDb ID from remote IDs
   */
  static extractImdbId(remoteIds?: TvdbRemoteId[]): string | undefined {
    const imdb = remoteIds?.find((r) => r.type === REMOTE_ID_TYPES.IMDB);
    return imdb?.id;
  }

  /**
   * Extract TMDb ID from remote IDs
   */
  static extractTmdbId(remoteIds?: TvdbRemoteId[]): number | undefined {
    const tmdb = remoteIds?.find((r) => r.type === REMOTE_ID_TYPES.TMDB);
    return tmdb?.id ? parseInt(tmdb.id, 10) : undefined;
  }

  /**
   * Make an authenticated API request
   */
  private async request<T>(path: string): Promise<T | null> {
    const token = await this.ensureToken();

    return withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const response = await fetch(`${this.config.baseUrl}${path}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Accept-Language': this.config.language,
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            if (response.status === 401) {
              // Token expired, clear it and retry
              this.token = null;
              throw new ExternalServiceError('TVDb', 'Authentication expired');
            }
            if (response.status === 404) {
              return null;
            }
            if (response.status === 429) {
              throw new ExternalServiceError('TVDb', 'Rate limit exceeded');
            }
            throw new ExternalServiceError(
              'TVDb',
              `API error: ${response.status} ${response.statusText}`
            );
          }

          const data = (await response.json()) as TvdbResponse<T>;
          return data.data;
        } finally {
          clearTimeout(timeoutId);
        }
      },
      EXTERNAL_SERVICE_RETRY
    );
  }
}
