/**
 * Interface for ratings integrations (MDBList)
 */

import type { BaseIntegration } from './base.js';
import type { AggregateRatings } from '../types.js';

/**
 * Ratings integration interface
 * Implemented by integrations that provide aggregate ratings (MDBList)
 */
export interface RatingsIntegration extends BaseIntegration {
  /**
   * Get aggregate ratings for a movie by IMDB ID
   */
  getMovieRatings(imdbId: string): Promise<AggregateRatings>;
  
  /**
   * Get aggregate ratings for a TV show by IMDB ID
   */
  getShowRatings(imdbId: string): Promise<AggregateRatings>;
}

/**
 * Type guard to check if an integration is a RatingsIntegration
 */
export function isRatingsIntegration(
  integration: BaseIntegration
): integration is RatingsIntegration {
  return 'getMovieRatings' in integration && 'getShowRatings' in integration;
}

