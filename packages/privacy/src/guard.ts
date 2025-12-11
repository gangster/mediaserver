/**
 * External Service Guard - Controls and audits all external connections.
 *
 * This is the central gatekeeper for any outbound requests to external services.
 * It enforces privacy settings and logs all external activity.
 */

import { generateId } from '@mediaserver/core';
import type { PrivacySettings } from '@mediaserver/core';

/** Known external services */
export type ExternalService =
  | 'tmdb'
  | 'tvdb'
  | 'trakt'
  | 'mdblist'
  | 'opensubtitles'
  | 'fanart'
  | 'omdb';

/** External request context */
export interface ExternalRequestContext {
  service: ExternalService;
  requestType: string;
  dataSummary: string;
  metadata?: Record<string, unknown>;
}

/** External request result */
export interface ExternalRequestResult<T> {
  data: T;
  cached: boolean;
  responseTimeMs: number;
}

/** External request log entry */
export interface ExternalRequestLogEntry {
  id: string;
  service: ExternalService;
  requestType: string;
  dataSummary: string;
  status: 'success' | 'error' | 'cached';
  responseTimeMs?: number;
  cached: boolean;
  createdAt: string;
}

/** Service configuration */
interface ServiceConfig {
  name: ExternalService;
  checkEnabled: (settings: PrivacySettings) => boolean;
  description: string;
}

/** Service configurations */
const SERVICE_CONFIGS: Record<ExternalService, ServiceConfig> = {
  tmdb: {
    name: 'tmdb',
    checkEnabled: (s) => s.tmdbEnabled,
    description: 'The Movie Database - metadata and images',
  },
  tvdb: {
    name: 'tvdb',
    checkEnabled: () => false, // Requires separate config
    description: 'TheTVDB - TV show metadata',
  },
  trakt: {
    name: 'trakt',
    checkEnabled: () => false, // Requires user opt-in
    description: 'Trakt - watch history sync',
  },
  mdblist: {
    name: 'mdblist',
    checkEnabled: () => false, // Requires separate config
    description: 'MDBList - aggregated ratings',
  },
  opensubtitles: {
    name: 'opensubtitles',
    checkEnabled: (s) => s.opensubtitlesEnabled,
    description: 'OpenSubtitles - subtitle search',
  },
  fanart: {
    name: 'fanart',
    checkEnabled: () => false, // Requires separate config
    description: 'Fanart.tv - additional artwork',
  },
  omdb: {
    name: 'omdb',
    checkEnabled: () => false, // Requires separate config
    description: 'OMDb - additional metadata',
  },
};

/**
 * External Service Guard
 *
 * Controls all outbound connections to external services.
 * Enforces privacy settings and maintains audit logs.
 */
export class ExternalServiceGuard {
  private settings: PrivacySettings;
  private logCallback?: (entry: ExternalRequestLogEntry) => Promise<void>;

  constructor(
    settings: PrivacySettings,
    logCallback?: (entry: ExternalRequestLogEntry) => Promise<void>
  ) {
    this.settings = settings;
    this.logCallback = logCallback;
  }

  /**
   * Updates the privacy settings.
   */
  updateSettings(settings: PrivacySettings): void {
    this.settings = settings;
  }

  /**
   * Checks if external connections are allowed at all.
   */
  isExternalConnectionsAllowed(): boolean {
    return this.settings.allowExternalConnections;
  }

  /**
   * Checks if a specific service is enabled.
   */
  isServiceEnabled(service: ExternalService): boolean {
    if (!this.settings.allowExternalConnections) {
      return false;
    }

    const config = SERVICE_CONFIGS[service];
    return config ? config.checkEnabled(this.settings) : false;
  }

  /**
   * Gets the list of enabled services.
   */
  getEnabledServices(): ExternalService[] {
    if (!this.settings.allowExternalConnections) {
      return [];
    }

    return (Object.keys(SERVICE_CONFIGS) as ExternalService[]).filter((service) =>
      this.isServiceEnabled(service)
    );
  }

  /**
   * Gets information about a service.
   */
  getServiceInfo(service: ExternalService): ServiceConfig | undefined {
    return SERVICE_CONFIGS[service];
  }

  /**
   * Executes an external request with guard checks.
   *
   * @param context - Request context
   * @param requestFn - The actual request function
   * @throws If service is not enabled
   */
  async executeRequest<T>(
    context: ExternalRequestContext,
    requestFn: () => Promise<T>
  ): Promise<ExternalRequestResult<T>> {
    // Check if service is enabled
    if (!this.isServiceEnabled(context.service)) {
      await this.logRequest({
        ...context,
        status: 'error',
        cached: false,
        error: `Service ${context.service} is not enabled`,
      });
      throw new Error(`External service '${context.service}' is not enabled`);
    }

    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let result: T;

    try {
      result = await requestFn();
    } catch (error) {
      status = 'error';
      const responseTimeMs = Date.now() - startTime;
      await this.logRequest({
        ...context,
        status,
        cached: false,
        responseTimeMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    const responseTimeMs = Date.now() - startTime;
    await this.logRequest({
      ...context,
      status,
      cached: false,
      responseTimeMs,
    });

    return {
      data: result,
      cached: false,
      responseTimeMs,
    };
  }

  /**
   * Logs a request (cached result).
   */
  async logCachedResult(context: ExternalRequestContext): Promise<void> {
    await this.logRequest({
      ...context,
      status: 'cached',
      cached: true,
    });
  }

  /**
   * Internal method to log requests.
   */
  private async logRequest(
    entry: ExternalRequestContext & {
      status: 'success' | 'error' | 'cached';
      cached: boolean;
      responseTimeMs?: number;
      error?: string;
    }
  ): Promise<void> {
    if (!this.logCallback) return;

    const logEntry: ExternalRequestLogEntry = {
      id: generateId(),
      service: entry.service,
      requestType: entry.requestType,
      dataSummary: entry.dataSummary,
      status: entry.status,
      responseTimeMs: entry.responseTimeMs,
      cached: entry.cached,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.logCallback(logEntry);
    } catch (error) {
      // Log callback failure shouldn't break the request
      console.error('Failed to log external request:', error);
    }
  }
}

/**
 * Creates a guard instance with database logging.
 */
export function createExternalServiceGuard(
  settings: PrivacySettings,
  logCallback?: (entry: ExternalRequestLogEntry) => Promise<void>
): ExternalServiceGuard {
  return new ExternalServiceGuard(settings, logCallback);
}

