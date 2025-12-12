/**
 * MDBList plugin configuration
 */

/**
 * MDBList configuration interface
 */
export interface MdblistConfig {
  /** MDBList API key (free at mdblist.com) */
  apiKey: string;

  /** Base URL for the API */
  baseUrl: string;

  /** Request timeout in milliseconds */
  timeout: number;

  /** Enable caching of responses */
  cacheEnabled: boolean;

  /** Cache TTL in seconds (default 24 hours) */
  cacheTtl: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_MDBLIST_CONFIG: Omit<MdblistConfig, 'apiKey'> = {
  baseUrl: 'https://mdblist.com/api',
  timeout: 10000,
  cacheEnabled: true,
  cacheTtl: 86400, // 24 hours
};

/**
 * Create a config with defaults
 */
export function createMdblistConfig(apiKey: string, overrides?: Partial<MdblistConfig>): MdblistConfig {
  return {
    ...DEFAULT_MDBLIST_CONFIG,
    apiKey,
    ...overrides,
  };
}
