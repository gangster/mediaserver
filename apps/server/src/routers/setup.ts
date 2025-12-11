/**
 * Setup wizard router.
 *
 * Handles first-time server setup including admin account creation,
 * initial library setup, and metadata provider configuration.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from './trpc.js';
import {
  users,
  libraries,
  settings,
  metadataProviders,
  privacySettings,
  eq,
  count,
} from '@mediaserver/db';
import { hashPassword } from '../lib/auth.js';
import { generateId } from '@mediaserver/core';

/** Settings keys */
const SETUP_COMPLETE_KEY = 'setup_complete';

/** Valid privacy levels */
const PRIVACY_LEVELS = ['maximum', 'private', 'balanced', 'open'] as const;
type PrivacyLevel = (typeof PRIVACY_LEVELS)[number];

/**
 * Privacy level presets - maps each level to its detailed settings.
 */
const PRIVACY_PRESETS: Record<
  PrivacyLevel,
  {
    allowExternalConnections: boolean;
    localAnalyticsEnabled: boolean;
    anonymousSharingEnabled: boolean;
    tmdbEnabled: boolean;
    tmdbProxyImages: boolean;
    opensubtitlesEnabled: boolean;
    maskFilePaths: boolean;
    maskMediaTitles: boolean;
    maskUserInfo: boolean;
    maskIpAddresses: boolean;
    analyticsRetentionDays: number | null;
    auditRetentionDays: number | null;
  }
> = {
  /** Maximum privacy - no external connections, no analytics */
  maximum: {
    allowExternalConnections: false,
    localAnalyticsEnabled: false,
    anonymousSharingEnabled: false,
    tmdbEnabled: false,
    tmdbProxyImages: true,
    opensubtitlesEnabled: false,
    maskFilePaths: true,
    maskMediaTitles: true,
    maskUserInfo: true,
    maskIpAddresses: true,
    analyticsRetentionDays: null,
    auditRetentionDays: 30,
  },
  /** Private - local analytics only, no external connections */
  private: {
    allowExternalConnections: false,
    localAnalyticsEnabled: true,
    anonymousSharingEnabled: false,
    tmdbEnabled: false,
    tmdbProxyImages: true,
    opensubtitlesEnabled: false,
    maskFilePaths: true,
    maskMediaTitles: true,
    maskUserInfo: true,
    maskIpAddresses: true,
    analyticsRetentionDays: 90,
    auditRetentionDays: 90,
  },
  /** Balanced - metadata fetching enabled with privacy protections */
  balanced: {
    allowExternalConnections: true,
    localAnalyticsEnabled: true,
    anonymousSharingEnabled: false,
    tmdbEnabled: true,
    tmdbProxyImages: true,
    opensubtitlesEnabled: false,
    maskFilePaths: true,
    maskMediaTitles: false,
    maskUserInfo: true,
    maskIpAddresses: true,
    analyticsRetentionDays: 180,
    auditRetentionDays: 180,
  },
  /** Open - full features enabled */
  open: {
    allowExternalConnections: true,
    localAnalyticsEnabled: true,
    anonymousSharingEnabled: true,
    tmdbEnabled: true,
    tmdbProxyImages: false,
    opensubtitlesEnabled: true,
    maskFilePaths: false,
    maskMediaTitles: false,
    maskUserInfo: false,
    maskIpAddresses: false,
    analyticsRetentionDays: 365,
    auditRetentionDays: 365,
  },
};

/** Supported metadata providers */
const METADATA_PROVIDERS = [
  { id: 'tmdb', name: 'The Movie Database (TMDB)', required: false },
  { id: 'tvdb', name: 'TheTVDB', required: false },
  { id: 'mdblist', name: 'MDBList', required: false },
  { id: 'trakt', name: 'Trakt', required: false },
  { id: 'fanart', name: 'Fanart.tv', required: false },
] as const;

/**
 * Setup router.
 *
 * All procedures are public since setup happens before any users exist.
 */
export const setupRouter = router({
  /**
   * Get setup status.
   * Returns whether setup is complete and current step progress.
   */
  status: publicProcedure.query(async ({ ctx }) => {
    // Check if setup is marked complete in settings
    const [setupSetting] = await ctx.db
      .select()
      .from(settings)
      .where(eq(settings.key, SETUP_COMPLETE_KEY))
      .limit(1);

    if (setupSetting?.value === 'true') {
      return {
        isComplete: true,
        currentStep: 5,
        hasOwner: true,
        hasLibrary: true,
        hasMetadataProvider: true,
      };
    }

    // Check if owner exists
    const [ownerCount] = await ctx.db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'owner'));

    const hasOwner = (ownerCount?.count ?? 0) > 0;

    // Check if any library exists
    const [libraryCount] = await ctx.db
      .select({ count: count() })
      .from(libraries);

    const hasLibrary = (libraryCount?.count ?? 0) > 0;

    // Check if any metadata provider is configured
    const [providerCount] = await ctx.db
      .select({ count: count() })
      .from(metadataProviders)
      .where(eq(metadataProviders.enabled, true));

    const hasMetadataProvider = (providerCount?.count ?? 0) > 0;

    // Determine current step
    let currentStep = 1;
    if (hasOwner) currentStep = 3;
    if (hasOwner && hasLibrary) currentStep = 4;
    if (hasOwner && hasLibrary && hasMetadataProvider) currentStep = 5;

    return {
      isComplete: false,
      currentStep,
      hasOwner,
      hasLibrary,
      hasMetadataProvider,
    };
  }),

  /**
   * Create the owner account.
   * Only works if no users exist in the database.
   */
  createOwner: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        displayName: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if any user already exists
      const [userCount] = await ctx.db.select({ count: count() }).from(users);

      if ((userCount?.count ?? 0) > 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'An owner account already exists. Setup cannot create another owner.',
        });
      }

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Create owner user
      const userId = generateId();
      const now = new Date().toISOString();

      await ctx.db.insert(users).values({
        id: userId,
        email: input.email.toLowerCase(),
        passwordHash,
        displayName: input.displayName,
        role: 'owner',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        userId,
        message: 'Owner account created successfully.',
      };
    }),

  /**
   * Add initial library during setup.
   */
  addLibrary: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        path: z.string().min(1),
        type: z.enum(['movie', 'tv']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify owner exists
      const [ownerCount] = await ctx.db
        .select({ count: count() })
        .from(users)
        .where(eq(users.role, 'owner'));

      if ((ownerCount?.count ?? 0) === 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Please create an owner account first.',
        });
      }

      // Create library
      const libraryId = generateId();
      const now = new Date().toISOString();

      await ctx.db.insert(libraries).values({
        id: libraryId,
        name: input.name,
        type: input.type,
        paths: JSON.stringify([input.path]),
        enabled: true,
      });

      return {
        success: true,
        libraryId,
        message: `Library "${input.name}" created successfully.`,
      };
    }),

  /**
   * Get available metadata providers.
   */
  getMetadataProviders: publicProcedure.query(async ({ ctx }) => {
    // Get configured providers
    const configured = await ctx.db.select().from(metadataProviders);

    // Merge with available providers
    return METADATA_PROVIDERS.map((provider) => {
      const config = configured.find((c) => c.id === provider.id);
      return {
        ...provider,
        configured: !!config?.apiKey,
        enabled: config?.enabled ?? false,
      };
    });
  }),

  /**
   * Save metadata provider API keys.
   */
  saveMetadataProviders: publicProcedure
    .input(
      z.object({
        providers: z.array(
          z.object({
            id: z.string(),
            apiKey: z.string().optional(),
            enabled: z.boolean(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();

      for (const provider of input.providers) {
        const providerInfo = METADATA_PROVIDERS.find((p) => p.id === provider.id);
        if (!providerInfo) continue;

        // Upsert provider config
        const existing = await ctx.db
          .select()
          .from(metadataProviders)
          .where(eq(metadataProviders.id, provider.id))
          .limit(1);

        if (existing.length > 0) {
          await ctx.db
            .update(metadataProviders)
            .set({
              apiKey: provider.apiKey || existing[0].apiKey,
              enabled: provider.enabled,
              updatedAt: now,
            })
            .where(eq(metadataProviders.id, provider.id));
        } else if (provider.apiKey) {
          await ctx.db.insert(metadataProviders).values({
            id: provider.id,
            name: providerInfo.name,
            apiKey: provider.apiKey,
            enabled: provider.enabled,
            priority: METADATA_PROVIDERS.findIndex((p) => p.id === provider.id),
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      return { success: true };
    }),

  /**
   * Save privacy settings.
   * Applies the selected privacy level preset to the privacy_settings table.
   */
  savePrivacySettings: publicProcedure
    .input(
      z.object({
        level: z.enum(PRIVACY_LEVELS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const preset = PRIVACY_PRESETS[input.level];

      // Upsert privacy settings with the selected level's preset values
      const existing = await ctx.db
        .select()
        .from(privacySettings)
        .where(eq(privacySettings.id, 'default'))
        .limit(1);

      if (existing.length > 0) {
        await ctx.db
          .update(privacySettings)
          .set({
            level: input.level,
            ...preset,
            updatedAt: now,
          })
          .where(eq(privacySettings.id, 'default'));
      } else {
        await ctx.db.insert(privacySettings).values({
          id: 'default',
          level: input.level,
          ...preset,
          updatedAt: now,
        });
      }

      return { success: true, level: input.level };
    }),

  /**
   * Complete the setup process.
   */
  complete: publicProcedure.mutation(async ({ ctx }) => {
    // Verify minimum requirements
    const [ownerCount] = await ctx.db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'owner'));

    if ((ownerCount?.count ?? 0) === 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Please create an owner account before completing setup.',
      });
    }

    // Mark setup as complete
    const now = new Date().toISOString();

    await ctx.db
      .insert(settings)
      .values({
        key: SETUP_COMPLETE_KEY,
        value: 'true',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: 'true', updatedAt: now },
      });

    return {
      success: true,
      message: 'Setup complete! Your media server is ready to use.',
    };
  }),
});

