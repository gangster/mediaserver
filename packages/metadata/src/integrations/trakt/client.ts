/**
 * Trakt.tv API client
 *
 * Trakt provides:
 * - Watch history sync
 * - Ratings
 * - Lists management
 * - Social features
 */

import { ExternalServiceError, withRetry, EXTERNAL_SERVICE_RETRY } from '@mediaserver/core';
import type { TraktConfig, TraktUserCredentials } from './config.js';
import type {
  TraktHistoryItem,
  TraktPlaybackItem,
  TraktSyncHistoryRequest,
  TraktSyncResponse,
  TraktScrobbleRequest,
  TraktTokenResponse,
  TraktSearchResult,
} from './types.js';

/**
 * Trakt API client with OAuth support
 */
export class TraktClient {
  private config: TraktConfig;
  private userCredentials: TraktUserCredentials | null = null;

  constructor(config: TraktConfig) {
    this.config = config;
  }

  /**
   * Set user credentials for authenticated requests
   */
  setUserCredentials(credentials: TraktUserCredentials): void {
    this.userCredentials = credentials;
  }

  /**
   * Get user credentials (for storage/refresh)
   */
  getUserCredentials(): TraktUserCredentials | null {
    return this.userCredentials;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.userCredentials !== null;
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri ?? this.config.redirectUri,
    });
    return `https://trakt.tv/oauth/authorize?${params}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, redirectUri?: string): Promise<TraktUserCredentials> {
    const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri ?? this.config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new ExternalServiceError('Trakt', 'Failed to exchange authorization code');
    }

    const data = (await response.json()) as TraktTokenResponse;
    const credentials = this.tokenResponseToCredentials(data);
    this.userCredentials = credentials;
    return credentials;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken?: string): Promise<TraktUserCredentials> {
    const tokenToRefresh = refreshToken ?? this.userCredentials?.refreshToken;
    if (!tokenToRefresh) {
      throw new ExternalServiceError('Trakt', 'No refresh token available');
    }

    const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: tokenToRefresh,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new ExternalServiceError('Trakt', 'Failed to refresh token');
    }

    const data = (await response.json()) as TraktTokenResponse;
    const credentials = this.tokenResponseToCredentials(data);
    this.userCredentials = credentials;
    return credentials;
  }

  // ============================================================
  // Watch History
  // ============================================================

  /**
   * Get user's watch history
   */
  async getHistory(
    type?: 'movies' | 'episodes',
    page: number = 1,
    limit: number = 100
  ): Promise<TraktHistoryItem[]> {
    const path = type ? `/sync/history/${type}` : '/sync/history';
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    return (await this.authenticatedRequest<TraktHistoryItem[]>(`${path}?${params}`)) ?? [];
  }

  /**
   * Add items to watch history
   */
  async addToHistory(items: TraktSyncHistoryRequest): Promise<TraktSyncResponse | null> {
    return this.authenticatedRequest<TraktSyncResponse>('/sync/history', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  /**
   * Remove items from watch history
   */
  async removeFromHistory(items: TraktSyncHistoryRequest): Promise<TraktSyncResponse | null> {
    return this.authenticatedRequest<TraktSyncResponse>('/sync/history/remove', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  // ============================================================
  // Playback Progress (Scrobbling)
  // ============================================================

  /**
   * Get playback progress for partially watched items
   */
  async getPlaybackProgress(): Promise<TraktPlaybackItem[]> {
    return (await this.authenticatedRequest<TraktPlaybackItem[]>('/sync/playback')) ?? [];
  }

  /**
   * Remove playback progress item
   */
  async removePlaybackProgress(id: number): Promise<boolean> {
    const result = await this.authenticatedRequest(`/sync/playback/${id}`, {
      method: 'DELETE',
    });
    return result !== null;
  }

  /**
   * Start scrobbling (marks as "watching")
   */
  async startScrobble(scrobble: TraktScrobbleRequest): Promise<unknown> {
    return this.authenticatedRequest('/scrobble/start', {
      method: 'POST',
      body: JSON.stringify(scrobble),
    });
  }

  /**
   * Pause scrobbling
   */
  async pauseScrobble(scrobble: TraktScrobbleRequest): Promise<unknown> {
    return this.authenticatedRequest('/scrobble/pause', {
      method: 'POST',
      body: JSON.stringify(scrobble),
    });
  }

  /**
   * Stop scrobbling (marks as watched if > 80% progress)
   */
  async stopScrobble(scrobble: TraktScrobbleRequest): Promise<unknown> {
    return this.authenticatedRequest('/scrobble/stop', {
      method: 'POST',
      body: JSON.stringify(scrobble),
    });
  }

  // ============================================================
  // Search and Lookup
  // ============================================================

  /**
   * Search for movies/shows
   */
  async search(query: string, type: 'movie' | 'show' = 'movie'): Promise<TraktSearchResult[]> {
    const params = new URLSearchParams({
      query,
      type,
    });
    return (await this.publicRequest<TraktSearchResult[]>(`/search/${type}?${params}`)) ?? [];
  }

  /**
   * Lookup by external ID
   */
  async lookupByExternalId(
    id: string,
    idType: 'imdb' | 'tmdb' | 'tvdb'
  ): Promise<TraktSearchResult[]> {
    return (await this.publicRequest<TraktSearchResult[]>(`/search/${idType}/${id}`)) ?? [];
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private tokenResponseToCredentials(response: TraktTokenResponse): TraktUserCredentials {
    const expiresAt = new Date((response.created_at + response.expires_in) * 1000).toISOString();

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt,
    };
  }

  private async ensureValidToken(): Promise<string> {
    if (!this.userCredentials) {
      throw new ExternalServiceError('Trakt', 'User not authenticated');
    }

    // Check if token is expired (with 5 minute buffer)
    const expiresAt = new Date(this.userCredentials.expiresAt).getTime();
    if (Date.now() >= expiresAt - 5 * 60 * 1000) {
      await this.refreshToken();
    }

    return this.userCredentials!.accessToken;
  }

  private getCommonHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': this.config.clientId,
    };
  }

  private async publicRequest<T>(path: string): Promise<T | null> {
    return withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const response = await fetch(`${this.config.baseUrl}${path}`, {
            headers: this.getCommonHeaders(),
            signal: controller.signal,
          });

          if (!response.ok) {
            if (response.status === 404) return null;
            if (response.status === 429) {
              throw new ExternalServiceError('Trakt', 'Rate limit exceeded');
            }
            throw new ExternalServiceError('Trakt', `API error: ${response.status}`);
          }

          return (await response.json()) as T;
        } finally {
          clearTimeout(timeoutId);
        }
      },
      EXTERNAL_SERVICE_RETRY
    );
  }

  private async authenticatedRequest<T>(path: string, options: RequestInit = {}): Promise<T | null> {
    const accessToken = await this.ensureValidToken();

    return withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const response = await fetch(`${this.config.baseUrl}${path}`, {
            ...options,
            headers: {
              ...this.getCommonHeaders(),
              Authorization: `Bearer ${accessToken}`,
              ...(options.headers ?? {}),
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            if (response.status === 401) {
              // Token might be invalid, try refreshing
              await this.refreshToken();
              throw new ExternalServiceError('Trakt', 'Authentication expired, retrying');
            }
            if (response.status === 404) return null;
            if (response.status === 429) {
              throw new ExternalServiceError('Trakt', 'Rate limit exceeded');
            }
            throw new ExternalServiceError('Trakt', `API error: ${response.status}`);
          }

          // Some endpoints return 204 No Content
          if (response.status === 204) {
            return {} as T;
          }

          return (await response.json()) as T;
        } finally {
          clearTimeout(timeoutId);
        }
      },
      EXTERNAL_SERVICE_RETRY
    );
  }
}

