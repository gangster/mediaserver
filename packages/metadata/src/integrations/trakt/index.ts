/**
 * Trakt Integration - Watch history sync
 *
 * Trakt provides:
 * - Watch history synchronization
 * - Playback progress sync
 * - Scrobbling (live playback tracking)
 * - External ID mapping
 */

import type { SyncIntegration } from '../../interfaces/sync.js';
import type {
  IntegrationConfig,
  OAuthTokens,
  WatchHistory,
  WatchedMovie,
  WatchedShow,
  ExternalIds,
} from '../../types.js';
import { TraktClient } from './client.js';
import { createTraktConfig, type TraktConfig, type TraktUserCredentials } from './config.js';
import type { TraktHistoryItem, TraktSyncHistoryRequest, TraktScrobbleRequest } from './types.js';

export { TraktClient } from './client.js';
export type { TraktConfig, TraktUserCredentials } from './config.js';
export * from './types.js';

/**
 * Trakt Integration - sync watch history with Trakt.tv
 */
export class TraktIntegration implements SyncIntegration {
  readonly id = 'trakt';
  readonly name = 'Trakt';
  readonly description = 'Sync watch history and progress with Trakt.tv';
  readonly apiKeyUrl = 'https://trakt.tv/oauth/applications';
  readonly requiresApiKey = true;
  readonly usesOAuth = true;
  readonly providesMetadata = false; // Only provides sync, not full metadata
  readonly supportsMovies = true;
  readonly supportsShows = true;
  readonly supportsAnime = false;
  readonly ratingSources = ['trakt'];

  private config: TraktConfig | null = null;
  private client: TraktClient | null = null;

  async initialize(config: IntegrationConfig): Promise<void> {
    // Trakt requires clientId and clientSecret instead of apiKey
    const clientId = config.options?.clientId as string ?? config.apiKey;
    const clientSecret = config.options?.clientSecret as string ?? '';

    // Don't initialize client if no client ID - will be marked as not ready
    if (!clientId) {
      return;
    }

    this.config = createTraktConfig(clientId, clientSecret, {
      redirectUri: config.options?.redirectUri as string,
    });

    this.client = new TraktClient(this.config);
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Not initialized' };
    }

    try {
      // Try a simple search (doesn't require auth)
      const results = await this.client.search('test', 'movie');
      if (Array.isArray(results)) {
        return { success: true };
      }
      return { success: false, error: 'Could not fetch test data' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  isReady(): boolean {
    return this.client !== null;
  }

  // ============================================================
  // OAuth Methods
  // ============================================================

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string): string {
    if (!this.client) {
      throw new Error('Trakt not initialized');
    }
    return this.client.getAuthorizationUrl(redirectUri);
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (!this.client) {
      throw new Error('Trakt not initialized');
    }

    const credentials = await this.client.exchangeCode(code, redirectUri);
    return {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt,
    };
  }

  /**
   * Refresh expired tokens
   */
  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    if (!this.client) {
      throw new Error('Trakt not initialized');
    }

    const credentials = await this.client.refreshToken(refreshToken);
    return {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt,
    };
  }

  /**
   * Set user credentials for authenticated requests
   */
  setUserCredentials(credentials: TraktUserCredentials): void {
    if (!this.client) {
      throw new Error('Trakt not initialized');
    }
    this.client.setUserCredentials(credentials);
  }

  /**
   * Check if a user is authenticated
   */
  isUserAuthenticated(): boolean {
    return this.client?.isAuthenticated() ?? false;
  }

  // ============================================================
  // Watch History Methods
  // ============================================================

  /**
   * Get user's watch history
   */
  async getWatchHistory(_userId: string): Promise<WatchHistory> {
    if (!this.client) {
      throw new Error('Trakt not initialized');
    }

    // Get movies and episodes separately for better organization
    const [movieHistory, episodeHistory] = await Promise.all([
      this.client.getHistory('movies', 1, 1000),
      this.client.getHistory('episodes', 1, 1000),
    ]);

    const movies = this.mapMovieHistory(movieHistory);
    const shows = this.mapEpisodeHistory(episodeHistory);

    return { movies, shows };
  }

  /**
   * Mark a movie as watched
   */
  async markMovieWatched(ids: ExternalIds, watchedAt?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Trakt not initialized');
    }

    const request: TraktSyncHistoryRequest = {
      movies: [
        {
          watched_at: watchedAt ?? new Date().toISOString(),
          ids: {
            trakt: ids.trakt,
            imdb: ids.imdb,
            tmdb: ids.tmdb,
          },
        },
      ],
    };

    await this.client.addToHistory(request);
  }

  /**
   * Mark an episode as watched
   */
  async markEpisodeWatched(
    ids: ExternalIds,
    seasonNumber: number,
    episodeNumber: number,
    watchedAt?: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Trakt not initialized');
    }

    const request: TraktSyncHistoryRequest = {
      episodes: [
        {
          watched_at: watchedAt ?? new Date().toISOString(),
          ids: {
            trakt: ids.trakt,
            imdb: ids.imdb,
            tmdb: ids.tmdb,
            tvdb: ids.tvdb,
          },
          season: seasonNumber,
          episode: episodeNumber,
        },
      ],
    };

    await this.client.addToHistory(request);
  }

  // ============================================================
  // Scrobbling Methods
  // ============================================================

  /**
   * Start scrobbling (marks as "watching")
   */
  async startScrobble(type: 'movie' | 'episode', ids: ExternalIds, progress: number): Promise<void> {
    if (!this.client) {
      throw new Error('Trakt not initialized');
    }

    const scrobble = this.buildScrobbleRequest(type, ids, progress);
    await this.client.startScrobble(scrobble);
  }

  /**
   * Stop scrobbling (marks as watched if > 80% progress)
   */
  async stopScrobble(type: 'movie' | 'episode', ids: ExternalIds, progress: number): Promise<void> {
    if (!this.client) {
      throw new Error('Trakt not initialized');
    }

    const scrobble = this.buildScrobbleRequest(type, ids, progress);
    await this.client.stopScrobble(scrobble);
  }

  /**
   * Get the underlying client for advanced usage
   */
  getClient(): TraktClient {
    if (!this.client) {
      throw new Error('Trakt not initialized');
    }
    return this.client;
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private mapMovieHistory(history: TraktHistoryItem[]): WatchedMovie[] {
    const movieMap = new Map<string, WatchedMovie>();

    for (const item of history) {
      if (item.type !== 'movie' || !item.movie) continue;

      const key = item.movie.ids.imdb ?? String(item.movie.ids.trakt);
      const existing = movieMap.get(key);

      if (existing) {
        existing.plays++;
        // Update watchedAt to most recent
        if (new Date(item.watched_at) > new Date(existing.watchedAt)) {
          existing.watchedAt = item.watched_at;
        }
      } else {
        movieMap.set(key, {
          externalIds: {
            trakt: item.movie.ids.trakt,
            imdb: item.movie.ids.imdb,
            tmdb: item.movie.ids.tmdb,
          },
          title: item.movie.title,
          year: item.movie.year,
          watchedAt: item.watched_at,
          plays: 1,
        });
      }
    }

    return Array.from(movieMap.values());
  }

  private mapEpisodeHistory(history: TraktHistoryItem[]): WatchedShow[] {
    const showMap = new Map<string, WatchedShow>();

    for (const item of history) {
      if (item.type !== 'episode' || !item.show || !item.episode) continue;

      const showKey = item.show.ids.imdb ?? String(item.show.ids.trakt);
      let show = showMap.get(showKey);

      if (!show) {
        show = {
          externalIds: {
            trakt: item.show.ids.trakt,
            imdb: item.show.ids.imdb,
            tmdb: item.show.ids.tmdb,
            tvdb: item.show.ids.tvdb,
          },
          title: item.show.title,
          year: item.show.year,
          episodes: [],
        };
        showMap.set(showKey, show);
      }

      // Find existing episode or add new
      const existingEpisode = show.episodes.find(
        (e) => e.seasonNumber === item.episode!.season && e.episodeNumber === item.episode!.number
      );

      if (existingEpisode) {
        existingEpisode.plays++;
        if (new Date(item.watched_at) > new Date(existingEpisode.watchedAt)) {
          existingEpisode.watchedAt = item.watched_at;
        }
      } else {
        show.episodes.push({
          seasonNumber: item.episode.season,
          episodeNumber: item.episode.number,
          watchedAt: item.watched_at,
          plays: 1,
        });
      }
    }

    return Array.from(showMap.values());
  }

  private buildScrobbleRequest(
    type: 'movie' | 'episode',
    ids: ExternalIds,
    progress: number,
    seasonNumber?: number,
    episodeNumber?: number
  ): TraktScrobbleRequest {
    if (type === 'movie') {
      return {
        movie: {
          ids: {
            trakt: ids.trakt,
            imdb: ids.imdb,
            tmdb: ids.tmdb,
          },
        },
        progress,
      };
    }

    return {
      show: {
        ids: {
          trakt: ids.trakt,
          imdb: ids.imdb,
          tmdb: ids.tmdb,
          tvdb: ids.tvdb,
        },
      },
      episode: {
        season: seasonNumber ?? 1,
        number: episodeNumber ?? 1,
      },
      progress,
    };
  }
}

