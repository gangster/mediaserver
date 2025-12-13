/**
 * TVDb plugin configuration
 */

/**
 * TVDb configuration interface
 */
export interface TvdbConfig {
  /** TVDb API key */
  apiKey: string;

  /** User PIN (optional, for subscriber features) */
  pin?: string;

  /** Base URL for the API */
  baseUrl: string;

  /** Preferred language for metadata */
  language: string;

  /** Request timeout in milliseconds */
  timeout: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_TVDB_CONFIG: Omit<TvdbConfig, 'apiKey'> = {
  baseUrl: 'https://api4.thetvdb.com/v4',
  language: 'eng',
  timeout: 10000,
};

/**
 * Create a config with defaults
 */
export function createTvdbConfig(apiKey: string, overrides?: Partial<TvdbConfig>): TvdbConfig {
  return {
    ...DEFAULT_TVDB_CONFIG,
    apiKey,
    ...overrides,
  };
}

