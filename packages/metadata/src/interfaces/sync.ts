/**
 * Interface for sync integrations (Trakt)
 */

import type { BaseIntegration } from './base.js';
import type { ExternalIds, OAuthTokens, WatchHistory } from '../types.js';

/**
 * Sync integration interface
 * Implemented by integrations that sync watch history (Trakt)
 */
export interface SyncIntegration extends BaseIntegration {
  /**
   * Get OAuth authorization URL for user to authenticate
   */
  getAuthorizationUrl(redirectUri: string): string;
  
  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens>;
  
  /**
   * Refresh expired tokens
   */
  refreshTokens(refreshToken: string): Promise<OAuthTokens>;
  
  /**
   * Get user's watch history
   */
  getWatchHistory(userId: string): Promise<WatchHistory>;
  
  /**
   * Mark a movie as watched
   */
  markMovieWatched(ids: ExternalIds, watchedAt?: string): Promise<void>;
  
  /**
   * Mark an episode as watched
   */
  markEpisodeWatched(
    ids: ExternalIds,
    seasonNumber: number,
    episodeNumber: number,
    watchedAt?: string
  ): Promise<void>;
  
  /**
   * Start scrobbling (for live playback tracking)
   */
  startScrobble(
    type: 'movie' | 'episode',
    ids: ExternalIds,
    progress: number
  ): Promise<void>;
  
  /**
   * Stop scrobbling
   */
  stopScrobble(
    type: 'movie' | 'episode',
    ids: ExternalIds,
    progress: number
  ): Promise<void>;
}

/**
 * Type guard to check if an integration is a SyncIntegration
 */
export function isSyncIntegration(
  integration: BaseIntegration
): integration is SyncIntegration {
  return (
    'getAuthorizationUrl' in integration &&
    'getWatchHistory' in integration &&
    'markMovieWatched' in integration
  );
}

