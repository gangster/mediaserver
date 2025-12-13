/**
 * Base interface for all metadata integrations
 */

import type { IntegrationConfig } from '../types.js';

/**
 * Base interface that all integrations must implement
 */
export interface BaseIntegration {
  /** Unique integration identifier (e.g., 'tmdb', 'tvdb') */
  readonly id: string;
  
  /** Human-readable name (e.g., 'The Movie Database') */
  readonly name: string;
  
  /** Description of the integration */
  readonly description: string;
  
  /** URL to get an API key */
  readonly apiKeyUrl?: string;
  
  /** Whether this integration requires an API key */
  readonly requiresApiKey: boolean;
  
  /** Whether this integration uses OAuth */
  readonly usesOAuth: boolean;
  
  /** Whether this integration can be used as a primary metadata source (title, synopsis, artwork) */
  readonly providesMetadata: boolean;
  
  /** Whether this integration supports movie metadata */
  readonly supportsMovies: boolean;
  
  /** Whether this integration supports TV show metadata */
  readonly supportsShows: boolean;
  
  /** Whether this integration is optimized for anime */
  readonly supportsAnime: boolean;
  
  /** Rating sources this integration provides */
  readonly ratingSources: string[];
  
  /**
   * Initialize the integration with configuration
   */
  initialize(config: IntegrationConfig): Promise<void>;
  
  /**
   * Test if the integration is properly configured and working
   */
  testConnection(): Promise<{ success: boolean; error?: string }>;
  
  /**
   * Check if the integration is ready to use
   */
  isReady(): boolean;
}

/**
 * Integration info for display in UI
 */
export interface IntegrationInfo {
  id: string;
  name: string;
  description: string;
  apiKeyUrl?: string;
  requiresApiKey: boolean;
  usesOAuth: boolean;
  providesMetadata: boolean;
  supportsMovies: boolean;
  supportsShows: boolean;
  supportsAnime: boolean;
  ratingSources: string[];
}


