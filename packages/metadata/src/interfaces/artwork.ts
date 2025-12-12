/**
 * Interface for artwork integrations (Fanart.tv)
 */

import type { BaseIntegration } from './base.js';
import type { Artwork } from '../types.js';

/**
 * Artwork integration interface
 * Implemented by integrations that provide enhanced artwork (Fanart.tv)
 */
export interface ArtworkIntegration extends BaseIntegration {
  /**
   * Get artwork for a movie by TMDB ID
   */
  getMovieArtwork(tmdbId: number): Promise<Artwork>;
  
  /**
   * Get artwork for a TV show by TVDB ID
   */
  getShowArtwork(tvdbId: number): Promise<Artwork>;
}

/**
 * Type guard to check if an integration is an ArtworkIntegration
 */
export function isArtworkIntegration(
  integration: BaseIntegration
): integration is ArtworkIntegration {
  return 'getMovieArtwork' in integration && 'getShowArtwork' in integration;
}

