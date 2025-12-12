/**
 * Settings router - admin and user settings.
 */

import { z } from 'zod';
import { router, protectedProcedure, adminProcedure, ownerProcedure } from './trpc.js';
import { updatePrivacySettingsInputSchema, updateProviderConfigInputSchema } from '@mediaserver/config';
import {
  privacySettings,
  serverLicense,
  remoteAccessConfig,
  providerConfigs,
  systemProviderDefaults,
  settings,
  eq,
} from '@mediaserver/db';

export const settingsRouter = router({
  /**
   * Get privacy settings.
   */
  getPrivacy: adminProcedure.query(async ({ ctx }) => {
    let privacy = await ctx.db.query.privacySettings.findFirst({
      where: eq(privacySettings.id, 'default'),
    });

    // Create default settings if not exists
    if (!privacy) {
      await ctx.db.insert(privacySettings).values({
        id: 'default',
      });

      privacy = await ctx.db.query.privacySettings.findFirst({
        where: eq(privacySettings.id, 'default'),
      });
    }

    return privacy!;
  }),

  /**
   * Update privacy settings.
   */
  updatePrivacy: adminProcedure
    .input(updatePrivacySettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(privacySettings)
        .set({
          ...input,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(privacySettings.id, 'default'));

      return ctx.db.query.privacySettings.findFirst({
        where: eq(privacySettings.id, 'default'),
      });
    }),

  /**
   * Get server license info.
   */
  getLicense: protectedProcedure.query(async ({ ctx }) => {
    let license = await ctx.db.query.serverLicense.findFirst({
      where: eq(serverLicense.id, 'default'),
    });

    if (!license) {
      await ctx.db.insert(serverLicense).values({
        id: 'default',
        tier: 'free',
      });

      license = await ctx.db.query.serverLicense.findFirst({
        where: eq(serverLicense.id, 'default'),
      });
    }

    // Only return safe fields to non-admin users
    if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
      return {
        tier: license!.tier,
        features: license!.features ? JSON.parse(license!.features) : null,
      };
    }

    return {
      ...license!,
      features: license!.features ? JSON.parse(license!.features) : null,
    };
  }),

  /**
   * Activate a license key.
   */
  activateLicense: ownerProcedure
    .input(
      z.object({
        licenseKey: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Validate license key with license server
      // For now, just store it

      await ctx.db
        .update(serverLicense)
        .set({
          licenseKey: input.licenseKey,
          tier: 'premium', // Would be determined by license server
          activatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(serverLicense.id, 'default'));

      return { success: true };
    }),

  /**
   * Get remote access configuration.
   */
  getRemoteAccess: adminProcedure.query(async ({ ctx }) => {
    let config = await ctx.db.query.remoteAccessConfig.findFirst({
      where: eq(remoteAccessConfig.id, 'default'),
    });

    if (!config) {
      await ctx.db.insert(remoteAccessConfig).values({
        id: 'default',
        enabled: false,
      });

      config = await ctx.db.query.remoteAccessConfig.findFirst({
        where: eq(remoteAccessConfig.id, 'default'),
      });
    }

    return config!;
  }),

  /**
   * Update remote access configuration.
   */
  updateRemoteAccess: ownerProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        tailscaleIp: z.string().optional(),
        tailscaleHostname: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(remoteAccessConfig)
        .set({
          ...input,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(remoteAccessConfig.id, 'default'));

      return ctx.db.query.remoteAccessConfig.findFirst({
        where: eq(remoteAccessConfig.id, 'default'),
      });
    }),

  /**
   * Get all provider configurations.
   */
  getProviders: adminProcedure.query(async ({ ctx }) => {
    const configs = await ctx.db.query.providerConfigs.findMany();
    const defaults = await ctx.db.query.systemProviderDefaults.findFirst({
      where: eq(systemProviderDefaults.id, 'default'),
    });

    return {
      providers: configs.map((c) => ({
        ...c,
        config: c.config ? JSON.parse(c.config) : null,
        // Mask API keys
        apiKey: c.apiKey ? '****' + c.apiKey.slice(-4) : null,
      })),
      defaults: defaults
        ? {
            primaryProvider: defaults.primaryProvider,
            enabledRatingSources: JSON.parse(defaults.enabledRatingSources),
            ratingSourceOrder: defaults.ratingSourceOrder
              ? JSON.parse(defaults.ratingSourceOrder)
              : null,
          }
        : null,
    };
  }),

  /**
   * Update a provider configuration.
   */
  updateProvider: adminProcedure
    .input(updateProviderConfigInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.providerConfigs.findFirst({
        where: eq(providerConfigs.providerId, input.providerId),
      });

      if (existing) {
        const updateData: Record<string, unknown> = {
          updatedAt: new Date().toISOString(),
        };

        if (input.enabled !== undefined) {
          updateData['enabled'] = input.enabled;
        }
        if (input.apiKey !== undefined) {
          updateData['apiKey'] = input.apiKey;
        }
        if (input.config !== undefined) {
          updateData['config'] = JSON.stringify(input.config);
        }

        await ctx.db
          .update(providerConfigs)
          .set(updateData)
          .where(eq(providerConfigs.providerId, input.providerId));
      } else {
        await ctx.db.insert(providerConfigs).values({
          providerId: input.providerId,
          enabled: input.enabled ?? true,
          apiKey: input.apiKey,
          config: input.config ? JSON.stringify(input.config) : null,
        });
      }

      return { success: true };
    }),

  /**
   * Get a generic setting value.
   */
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const setting = await ctx.db.query.settings.findFirst({
        where: eq(settings.key, input.key),
      });

      return setting?.value ?? null;
    }),

  /**
   * Set a generic setting value (admin only).
   */
  set: adminProcedure
    .input(
      z.object({
        key: z.string().min(1).max(100),
        value: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.settings.findFirst({
        where: eq(settings.key, input.key),
      });

      if (existing) {
        await ctx.db
          .update(settings)
          .set({
            value: input.value,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(settings.key, input.key));
      } else {
        await ctx.db.insert(settings).values({
          key: input.key,
          value: input.value,
        });
      }

      return { success: true };
    }),

  /**
   * Get server statistics (for admin dashboard).
   */
  stats: adminProcedure.query(async ({ ctx }) => {
    const { movies, tvShows, episodes, users, count } = await import('@mediaserver/db');

    const [movieCount] = await ctx.db.select({ count: count() }).from(movies);
    const [showCount] = await ctx.db.select({ count: count() }).from(tvShows);
    const [episodeCount] = await ctx.db.select({ count: count() }).from(episodes);
    const [userCount] = await ctx.db.select({ count: count() }).from(users);

    return {
      movies: movieCount?.count ?? 0,
      shows: showCount?.count ?? 0,
      episodes: episodeCount?.count ?? 0,
      users: userCount?.count ?? 0,
    };
  }),
});

