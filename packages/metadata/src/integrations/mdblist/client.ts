/**
 * MDBList API client
 *
 * MDBList aggregates ratings from multiple sources:
 * - IMDb
 * - Rotten Tomatoes (critics + audience)
 * - Metacritic
 * - Letterboxd
 * - Trakt
 * - TMDb
 */

import { ExternalServiceError, withRetry, EXTERNAL_SERVICE_RETRY } from '@mediaserver/core';
import type { MdblistConfig } from './config.js';
import type { MdblistMediaResponse, MdblistSearchResponse } from './types.js';

/**
 * MDBList API client with retry logic
 */
export class MdblistClient {
  private config: MdblistConfig;

  constructor(config: MdblistConfig) {
    this.config = config;
  }

  /**
   * Lookup media by IMDb ID
   */
  async getByImdbId(imdbId: string): Promise<MdblistMediaResponse | null> {
    return this.request<MdblistMediaResponse>(`?i=${imdbId}`);
  }

  /**
   * Lookup media by TMDb ID
   */
  async getByTmdbId(tmdbId: number, type: 'movie' | 'show'): Promise<MdblistMediaResponse | null> {
    const mediaType = type === 'movie' ? 'movie' : 'show';
    return this.request<MdblistMediaResponse>(`?tm=${tmdbId}&m=${mediaType}`);
  }

  /**
   * Lookup media by TVDb ID
   */
  async getByTvdbId(tvdbId: number): Promise<MdblistMediaResponse | null> {
    return this.request<MdblistMediaResponse>(`?tv=${tvdbId}`);
  }

  /**
   * Lookup media by Trakt ID
   */
  async getByTraktId(traktId: number, type: 'movie' | 'show'): Promise<MdblistMediaResponse | null> {
    const mediaType = type === 'movie' ? 'movie' : 'show';
    return this.request<MdblistMediaResponse>(`?t=${traktId}&m=${mediaType}`);
  }

  /**
   * Search for media by title
   */
  async search(query: string, year?: number): Promise<MdblistMediaResponse[]> {
    const params = new URLSearchParams({ s: query });
    if (year) {
      params.set('y', String(year));
    }

    const result = await this.request<MdblistSearchResponse>(`?${params}`);
    return result?.search ?? [];
  }

  /**
   * Make an API request with retry logic
   */
  private async request<T>(path: string): Promise<T | null> {
    const url = `${this.config.baseUrl}${path}&apikey=${this.config.apiKey}`;

    return withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const response = await fetch(url, { signal: controller.signal });

          if (!response.ok) {
            if (response.status === 401) {
              throw new ExternalServiceError('MDBList', 'Invalid API key');
            }
            if (response.status === 429) {
              throw new ExternalServiceError('MDBList', 'Rate limit exceeded');
            }
            if (response.status === 404) {
              return null;
            }
            throw new ExternalServiceError(
              'MDBList',
              `API error: ${response.status} ${response.statusText}`
            );
          }

          const data = (await response.json()) as T & { error?: string };

          // MDBList returns an error object for not found
          if ('error' in data && data.error) {
            return null;
          }

          return data;
        } finally {
          clearTimeout(timeoutId);
        }
      },
      EXTERNAL_SERVICE_RETRY
    );
  }
}
