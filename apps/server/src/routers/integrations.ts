/**
 * Integrations router - manage metadata integration settings and API keys.
 */

import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from './trpc.js';
import { providerConfigs, oauthTokens, eq, and, type Database } from '@mediaserver/db';
import { getMetadataManager, initializeMetadataManager } from '../services/metadata.js';
import { 
  isSyncIntegration,
  TmdbIntegration,
  MdblistIntegration,
  TvdbIntegration,
  TraktIntegration,
} from '@mediaserver/metadata';
import { nanoid } from 'nanoid';

/**
 * Test an integration with a specific API key without saving it.
 * Creates a temporary integration instance just for testing.
 */
async function testIntegrationWithKey(
  integrationId: string,
  apiKey: string,
  _db: Database
): Promise<{ success: boolean; error?: string }> {
  try {
    let integration;
    
    switch (integrationId) {
      case 'tmdb':
        integration = new TmdbIntegration();
        break;
      case 'mdblist':
        integration = new MdblistIntegration();
        break;
      case 'tvdb':
        integration = new TvdbIntegration();
        break;
      case 'trakt':
        integration = new TraktIntegration();
        break;
      default:
        return { success: false, error: `Unknown integration: ${integrationId}` };
    }
    
    // Initialize with the provided API key
    await integration.initialize({
      id: integrationId,
      name: integration.name,
      apiKey,
      enabled: true,
      options: {},
    });
    
    // Check if it initialized properly
    if (!integration.isReady()) {
      return { success: false, error: 'Failed to initialize integration with provided key' };
    }
    
    // Test the connection
    return await integration.testConnection();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during test',
    };
  }
}

/**
 * Integration info type
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
  enabled: boolean;
  hasApiKey: boolean;
}

export const integrationsRouter = router({
  /**
   * List all available integrations with their status.
   */
  list: adminProcedure.query(async ({ ctx }): Promise<IntegrationInfo[]> => {
    try {
      const manager = getMetadataManager();
      const infos = manager.getIntegrationInfos();
      console.log('[integrations.list] Found integrations:', infos.length, infos.map(i => i.id));

      // Get stored configs from database
      const configs = await ctx.db.query.providerConfigs.findMany();
      const configMap = new Map(configs.map((c) => [c.providerId, c]));

      return infos.map((info) => {
        const config = configMap.get(info.id);
        return {
          ...info,
          enabled: config?.enabled ?? false,
          hasApiKey: !!(config?.apiKey),
        };
      });
    } catch (error) {
      // Manager not initialized - return empty list
      console.error('[integrations.list] Error:', error);
      return [];
    }
  }),

  /**
   * Get a single integration's config.
   * Returns the full API key for admins to allow editing.
   */
  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const config = await ctx.db.query.providerConfigs.findFirst({
        where: eq(providerConfigs.providerId, input.id),
      });

      try {
        const manager = getMetadataManager();
        const infos = manager.getIntegrationInfos();
        const info = infos.find((i) => i.id === input.id);

        return {
          ...info,
          enabled: config?.enabled ?? false,
          hasApiKey: !!(config?.apiKey),
          // Return the actual API key for admins (self-hosted, so this is acceptable)
          apiKey: config?.apiKey ?? null,
          config: config?.config ? JSON.parse(config.config) : null,
        };
      } catch {
        return {
          id: input.id,
          enabled: config?.enabled ?? false,
          hasApiKey: !!(config?.apiKey),
          apiKey: config?.apiKey ?? null,
          config: config?.config ? JSON.parse(config.config) : null,
        };
      }
    }),

  /**
   * Update an integration's configuration (API key, enabled status).
   * Send apiKey: null to clear the API key, undefined to leave unchanged.
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        apiKey: z.string().nullable().optional(), // null = clear, undefined = no change
        enabled: z.boolean().optional(),
        config: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.providerConfigs.findFirst({
        where: eq(providerConfigs.providerId, input.id),
      });

      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      // Handle API key: null = clear, undefined = no change, string = set
      if (input.apiKey !== undefined) {
        updateData['apiKey'] = input.apiKey; // Can be null to clear or string to set
      }
      if (input.enabled !== undefined) {
        updateData['enabled'] = input.enabled;
      }
      if (input.config !== undefined) {
        updateData['config'] = JSON.stringify(input.config);
      }

      if (existing) {
        await ctx.db.update(providerConfigs)
          .set(updateData)
          .where(eq(providerConfigs.providerId, input.id));
      } else {
        await ctx.db.insert(providerConfigs).values({
          providerId: input.id,
          enabled: input.enabled ?? false,
          apiKey: input.apiKey,
          config: input.config ? JSON.stringify(input.config) : null,
        });
      }

      // Re-initialize metadata manager if TMDB key was updated
      if (input.id === 'tmdb' && input.apiKey) {
        try {
          await initializeMetadataManager({}, input.apiKey);
        } catch (error) {
          console.error('Failed to re-initialize metadata manager:', error);
        }
      }

      return { success: true };
    }),

  /**
   * Test an integration's connection.
   * Optionally accepts an API key to test with (for testing before saving).
   */
  testConnection: adminProcedure
    .input(z.object({ 
      id: z.string(),
      apiKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const manager = getMetadataManager();
        
        // If an API key is provided, test with that directly
        if (input.apiKey) {
          return await testIntegrationWithKey(input.id, input.apiKey, ctx.db);
        }
        
        // Otherwise, use the existing integration
        const integration = manager.getIntegration(input.id);

        if (!integration) {
          return { success: false, error: 'Integration not found' };
        }

        if (!integration.isReady()) {
          return { success: false, error: 'Integration not configured - please provide an API key' };
        }

        return integration.testConnection();
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),

  /**
   * Get OAuth authorization URL for integrations that use OAuth (e.g., Trakt).
   */
  getOAuthUrl: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        redirectUri: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const manager = getMetadataManager();
        const integration = manager.getIntegration(input.id);

        if (!integration) {
          return { url: null, error: 'Integration not found' };
        }

        if (!isSyncIntegration(integration)) {
          return { url: null, error: 'Integration does not support OAuth' };
        }

        const url = integration.getAuthorizationUrl(input.redirectUri);
        return { url, error: null };
      } catch (error) {
        return {
          url: null,
          error: error instanceof Error ? error.message : 'Failed to get OAuth URL',
        };
      }
    }),

  /**
   * Handle OAuth callback - exchange code for tokens and store them.
   */
  handleOAuthCallback: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        code: z.string(),
        redirectUri: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const manager = getMetadataManager();
        const integration = manager.getIntegration(input.id);

        if (!integration) {
          return { success: false, error: 'Integration not found' };
        }

        if (!isSyncIntegration(integration)) {
          return { success: false, error: 'Integration does not support OAuth' };
        }

        // Exchange code for tokens
        const tokens = await integration.exchangeCodeForTokens(input.code, input.redirectUri);

        // Check for existing token
        const existing = await ctx.db.query.oauthTokens.findFirst({
          where: and(
            eq(oauthTokens.userId, ctx.userId!),
            eq(oauthTokens.provider, input.id)
          ),
        });

        if (existing) {
          // Update existing token
          await ctx.db.update(oauthTokens)
            .set({
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresAt: tokens.expiresAt,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(oauthTokens.id, existing.id));
        } else {
          // Insert new token
          await ctx.db.insert(oauthTokens).values({
            id: nanoid(),
            userId: ctx.userId!,
            provider: input.id,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
          });
        }

        return { success: true, error: null };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to handle OAuth callback',
        };
      }
    }),

  /**
   * Disconnect OAuth for a provider (remove tokens).
   */
  disconnectOAuth: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(oauthTokens)
        .where(and(
          eq(oauthTokens.userId, ctx.userId!),
          eq(oauthTokens.provider, input.id)
        ));

      return { success: true };
    }),

  /**
   * Get OAuth connection status for the current user.
   */
  getOAuthStatus: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const token = await ctx.db.query.oauthTokens.findFirst({
        where: and(
          eq(oauthTokens.userId, ctx.userId!),
          eq(oauthTokens.provider, input.id)
        ),
      });

      return {
        connected: !!token,
        expiresAt: token?.expiresAt ?? null,
      };
    }),

  /**
   * Get rating sources configuration.
   * Available to all authenticated users so they see filtered ratings.
   */
  getRatingSources: protectedProcedure.query(async ({ ctx }) => {
    const defaults = await ctx.db.query.systemProviderDefaults.findFirst();

    return {
      // Keep for backwards compatibility
      primaryProvider: defaults?.primaryProvider ?? 'tmdb',
      enabledSources: defaults?.enabledRatingSources
        ? JSON.parse(defaults.enabledRatingSources)
        : ['imdb', 'rt_critics'],
    };
  }),

  /**
   * Update rating sources configuration (only rating sources, not primary providers).
   */
  setRatingSources: adminProcedure
    .input(
      z.object({
        enabledSources: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.systemProviderDefaults.findFirst();

      if (existing) {
        const { systemProviderDefaults } = await import('@mediaserver/db');
        await ctx.db.update(systemProviderDefaults)
          .set({
            enabledRatingSources: JSON.stringify(input.enabledSources),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(systemProviderDefaults.id, existing.id));
      } else {
        const { systemProviderDefaults } = await import('@mediaserver/db');
        await ctx.db.insert(systemProviderDefaults).values({
          id: 'default',
          primaryMovieProvider: 'tmdb',
          primaryTvProvider: 'tmdb',
          enabledRatingSources: JSON.stringify(input.enabledSources),
        });
      }

      return { success: true };
    }),

  /**
   * Get primary metadata providers configuration.
   */
  getPrimaryProviders: adminProcedure.query(async ({ ctx }) => {
    const defaults = await ctx.db.query.systemProviderDefaults.findFirst();

    return {
      movieProvider: defaults?.primaryMovieProvider ?? 'tmdb',
      tvProvider: defaults?.primaryTvProvider ?? 'tmdb',
    };
  }),

  /**
   * Update primary metadata providers.
   */
  setPrimaryProviders: adminProcedure
    .input(
      z.object({
        movieProvider: z.string().optional(),
        tvProvider: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.systemProviderDefaults.findFirst();

      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (input.movieProvider !== undefined) {
        updateData['primaryMovieProvider'] = input.movieProvider;
      }
      if (input.tvProvider !== undefined) {
        updateData['primaryTvProvider'] = input.tvProvider;
      }

      if (existing) {
        const { systemProviderDefaults } = await import('@mediaserver/db');
        await ctx.db.update(systemProviderDefaults)
          .set(updateData)
          .where(eq(systemProviderDefaults.id, existing.id));
      } else {
        const { systemProviderDefaults } = await import('@mediaserver/db');
        await ctx.db.insert(systemProviderDefaults).values({
          id: 'default',
          primaryMovieProvider: input.movieProvider ?? 'tmdb',
          primaryTvProvider: input.tvProvider ?? 'tmdb',
          enabledRatingSources: JSON.stringify(['imdb', 'rt_critics']),
        });
      }

      return { success: true };
    }),
});
