/**
 * Trakt plugin configuration
 */

/**
 * Trakt configuration interface
 */
export interface TraktConfig {
  /** Trakt client ID (from your Trakt app) */
  clientId: string;

  /** Trakt client secret (from your Trakt app) */
  clientSecret: string;

  /** OAuth redirect URI */
  redirectUri: string;

  /** Base URL for the API */
  baseUrl: string;

  /** Request timeout in milliseconds */
  timeout: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_TRAKT_CONFIG: Omit<TraktConfig, 'clientId' | 'clientSecret'> = {
  redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
  baseUrl: 'https://api.trakt.tv',
  timeout: 10000,
};

/**
 * Create a config with defaults
 */
export function createTraktConfig(
  clientId: string,
  clientSecret: string,
  overrides?: Partial<TraktConfig>
): TraktConfig {
  return {
    ...DEFAULT_TRAKT_CONFIG,
    clientId,
    clientSecret,
    ...overrides,
  };
}

/**
 * User-specific Trakt credentials (stored per-user)
 */
export interface TraktUserCredentials {
  /** OAuth access token */
  accessToken: string;

  /** OAuth refresh token */
  refreshToken: string;

  /** Token expiry timestamp (ISO string) */
  expiresAt: string;
}

