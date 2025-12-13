/**
 * Playback Preferences Router
 *
 * Handles unified audio and subtitle preferences, language rules,
 * per-media overrides, and session state management.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure } from './trpc.js';
import { uuidSchema } from '@mediaserver/config';
import {
  playbackPreferences,
  languageRules,
  mediaLanguageOverrides,
  playbackSessionState,
  audioTracks,
  subtitleTracks,
  eq,
  and,
  asc,
  sql,
} from '@mediaserver/db';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger.js';
import { selectTracks } from '../services/track-selection.js';

const log = logger.child({ router: 'playback-preferences' });

// =============================================================================
// Input Schemas
// =============================================================================

const subtitleModeSchema = z.enum(['off', 'auto', 'always', 'foreign_only']);
const audioQualitySchema = z.enum(['highest', 'balanced', 'compatible']);

const preferencesUpdateSchema = z.object({
  audioLanguages: z.array(z.string()).optional(),
  subtitleLanguages: z.array(z.string()).optional(),
  subtitleMode: subtitleModeSchema.optional(),
  alwaysShowForced: z.boolean().optional(),
  preferSdh: z.boolean().optional(),
  preferOriginalAudio: z.boolean().optional(),
  audioQuality: audioQualitySchema.optional(),
  rememberWithinSession: z.boolean().optional(),
});

const languageRuleConditionsSchema = z.object({
  genres: z.array(z.string()).optional(),
  originCountries: z.array(z.string()).optional(),
  originalLanguages: z.array(z.string()).optional(),
  libraryIds: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
});

const languageRuleSchema = z.object({
  name: z.string().min(1).max(100),
  priority: z.number().int().min(0).max(999).optional(),
  enabled: z.boolean().optional(),
  conditions: languageRuleConditionsSchema,
  audioLanguages: z.array(z.string()).min(1),
  subtitleLanguages: z.array(z.string()).min(1),
  subtitleMode: subtitleModeSchema.optional(),
});

const mediaOverrideSchema = z.object({
  mediaType: z.enum(['movie', 'show']),
  mediaId: uuidSchema,
  audioLanguages: z.array(z.string()).nullable().optional(),
  subtitleLanguages: z.array(z.string()).nullable().optional(),
  subtitleMode: subtitleModeSchema.nullable().optional(),
});

// =============================================================================
// Router
// =============================================================================

export const playbackPreferencesRouter = router({
  // ===========================================================================
  // Global Preferences
  // ===========================================================================

  /**
   * Get user's global playback preferences.
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.db.query.playbackPreferences.findFirst({
      where: eq(playbackPreferences.userId, ctx.userId),
    });

    if (!prefs) {
      // Return defaults
      return {
        audioLanguages: ['eng'],
        subtitleLanguages: ['eng'],
        subtitleMode: 'auto' as const,
        alwaysShowForced: true,
        preferSdh: false,
        preferOriginalAudio: false,
        audioQuality: 'highest' as const,
        rememberWithinSession: true,
      };
    }

    return {
      audioLanguages: JSON.parse(prefs.audioLanguages) as string[],
      subtitleLanguages: JSON.parse(prefs.subtitleLanguages) as string[],
      subtitleMode: prefs.subtitleMode as 'off' | 'auto' | 'always' | 'foreign_only',
      alwaysShowForced: prefs.alwaysShowForced,
      preferSdh: prefs.preferSdh,
      preferOriginalAudio: prefs.preferOriginalAudio,
      audioQuality: prefs.audioQuality as 'highest' | 'balanced' | 'compatible',
      rememberWithinSession: prefs.rememberWithinSession,
    };
  }),

  /**
   * Update user's global playback preferences.
   */
  updatePreferences: protectedProcedure
    .input(preferencesUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.playbackPreferences.findFirst({
        where: eq(playbackPreferences.userId, ctx.userId),
      });

      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (input.audioLanguages !== undefined) {
        updateData['audioLanguages'] = JSON.stringify(input.audioLanguages);
      }
      if (input.subtitleLanguages !== undefined) {
        updateData['subtitleLanguages'] = JSON.stringify(input.subtitleLanguages);
      }
      if (input.subtitleMode !== undefined) {
        updateData['subtitleMode'] = input.subtitleMode;
      }
      if (input.alwaysShowForced !== undefined) {
        updateData['alwaysShowForced'] = input.alwaysShowForced;
      }
      if (input.preferSdh !== undefined) {
        updateData['preferSdh'] = input.preferSdh;
      }
      if (input.preferOriginalAudio !== undefined) {
        updateData['preferOriginalAudio'] = input.preferOriginalAudio;
      }
      if (input.audioQuality !== undefined) {
        updateData['audioQuality'] = input.audioQuality;
      }
      if (input.rememberWithinSession !== undefined) {
        updateData['rememberWithinSession'] = input.rememberWithinSession;
      }

      if (existing) {
        await ctx.db
          .update(playbackPreferences)
          .set(updateData)
          .where(eq(playbackPreferences.userId, ctx.userId));
      } else {
        await ctx.db.insert(playbackPreferences).values({
          userId: ctx.userId,
          audioLanguages: JSON.stringify(input.audioLanguages ?? ['eng']),
          subtitleLanguages: JSON.stringify(input.subtitleLanguages ?? ['eng']),
          subtitleMode: input.subtitleMode ?? 'auto',
          alwaysShowForced: input.alwaysShowForced ?? true,
          preferSdh: input.preferSdh ?? false,
          preferOriginalAudio: input.preferOriginalAudio ?? false,
          audioQuality: input.audioQuality ?? 'highest',
          rememberWithinSession: input.rememberWithinSession ?? true,
        });
      }

      log.debug({ userId: ctx.userId }, 'Updated playback preferences');
      return { success: true };
    }),

  // ===========================================================================
  // Language Rules
  // ===========================================================================

  /**
   * Get all language rules for the user.
   */
  getRules: protectedProcedure.query(async ({ ctx }) => {
    const rules = await ctx.db.query.languageRules.findMany({
      where: eq(languageRules.userId, ctx.userId),
      orderBy: [asc(languageRules.priority)],
    });

    return rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      isBuiltIn: rule.isBuiltIn,
      enabled: rule.enabled,
      conditions: JSON.parse(rule.conditions),
      audioLanguages: JSON.parse(rule.audioLanguages),
      subtitleLanguages: JSON.parse(rule.subtitleLanguages),
      subtitleMode: rule.subtitleMode,
    }));
  }),

  /**
   * Create a new language rule.
   */
  createRule: protectedProcedure
    .input(languageRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const id = nanoid();

      await ctx.db.insert(languageRules).values({
        id,
        userId: ctx.userId,
        name: input.name,
        priority: input.priority ?? 100,
        isBuiltIn: false,
        enabled: input.enabled ?? true,
        conditions: JSON.stringify(input.conditions),
        audioLanguages: JSON.stringify(input.audioLanguages),
        subtitleLanguages: JSON.stringify(input.subtitleLanguages),
        subtitleMode: input.subtitleMode ?? null,
      });

      log.info({ userId: ctx.userId, ruleId: id, name: input.name }, 'Created language rule');
      return { id };
    }),

  /**
   * Update an existing language rule.
   */
  updateRule: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        ...languageRuleSchema.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.languageRules.findFirst({
        where: and(
          eq(languageRules.id, input.id),
          eq(languageRules.userId, ctx.userId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Language rule not found',
        });
      }

      await ctx.db
        .update(languageRules)
        .set({
          name: input.name,
          priority: input.priority ?? existing.priority,
          enabled: input.enabled ?? existing.enabled,
          conditions: JSON.stringify(input.conditions),
          audioLanguages: JSON.stringify(input.audioLanguages),
          subtitleLanguages: JSON.stringify(input.subtitleLanguages),
          subtitleMode: input.subtitleMode ?? null,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(eq(languageRules.id, input.id), eq(languageRules.userId, ctx.userId))
        );

      log.debug({ userId: ctx.userId, ruleId: input.id }, 'Updated language rule');
      return { success: true };
    }),

  /**
   * Delete a language rule.
   */
  deleteRule: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.languageRules.findFirst({
        where: and(
          eq(languageRules.id, input.id),
          eq(languageRules.userId, ctx.userId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Language rule not found',
        });
      }

      if (existing.isBuiltIn) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot delete built-in rules. Disable them instead.',
        });
      }

      await ctx.db
        .delete(languageRules)
        .where(
          and(eq(languageRules.id, input.id), eq(languageRules.userId, ctx.userId))
        );

      log.info({ userId: ctx.userId, ruleId: input.id }, 'Deleted language rule');
      return { success: true };
    }),

  /**
   * Toggle a rule's enabled state.
   */
  toggleRule: protectedProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.languageRules.findFirst({
        where: and(
          eq(languageRules.id, input.id),
          eq(languageRules.userId, ctx.userId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Language rule not found',
        });
      }

      await ctx.db
        .update(languageRules)
        .set({
          enabled: input.enabled,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(eq(languageRules.id, input.id), eq(languageRules.userId, ctx.userId))
        );

      return { success: true };
    }),

  // ===========================================================================
  // Media Overrides
  // ===========================================================================

  /**
   * Get override for a specific media item.
   */
  getOverride: protectedProcedure
    .input(z.object({ mediaType: z.enum(['movie', 'show']), mediaId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const override = await ctx.db.query.mediaLanguageOverrides.findFirst({
        where: and(
          eq(mediaLanguageOverrides.userId, ctx.userId),
          eq(mediaLanguageOverrides.mediaType, input.mediaType),
          eq(mediaLanguageOverrides.mediaId, input.mediaId)
        ),
      });

      if (!override) {
        return null;
      }

      return {
        audioLanguages: override.audioLanguages
          ? JSON.parse(override.audioLanguages)
          : null,
        subtitleLanguages: override.subtitleLanguages
          ? JSON.parse(override.subtitleLanguages)
          : null,
        subtitleMode: override.subtitleMode,
      };
    }),

  /**
   * Set override for a specific media item.
   */
  setOverride: protectedProcedure
    .input(mediaOverrideSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.mediaLanguageOverrides.findFirst({
        where: and(
          eq(mediaLanguageOverrides.userId, ctx.userId),
          eq(mediaLanguageOverrides.mediaType, input.mediaType),
          eq(mediaLanguageOverrides.mediaId, input.mediaId)
        ),
      });

      if (existing) {
        await ctx.db
          .update(mediaLanguageOverrides)
          .set({
            audioLanguages: input.audioLanguages
              ? JSON.stringify(input.audioLanguages)
              : null,
            subtitleLanguages: input.subtitleLanguages
              ? JSON.stringify(input.subtitleLanguages)
              : null,
            subtitleMode: input.subtitleMode ?? null,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(mediaLanguageOverrides.userId, ctx.userId),
              eq(mediaLanguageOverrides.mediaType, input.mediaType),
              eq(mediaLanguageOverrides.mediaId, input.mediaId)
            )
          );
      } else {
        await ctx.db.insert(mediaLanguageOverrides).values({
          userId: ctx.userId,
          mediaType: input.mediaType,
          mediaId: input.mediaId,
          audioLanguages: input.audioLanguages
            ? JSON.stringify(input.audioLanguages)
            : null,
          subtitleLanguages: input.subtitleLanguages
            ? JSON.stringify(input.subtitleLanguages)
            : null,
          subtitleMode: input.subtitleMode ?? null,
        });
      }

      log.debug(
        { userId: ctx.userId, mediaType: input.mediaType, mediaId: input.mediaId },
        'Set media language override'
      );
      return { success: true };
    }),

  /**
   * Clear override for a specific media item.
   */
  clearOverride: protectedProcedure
    .input(z.object({ mediaType: z.enum(['movie', 'show']), mediaId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(mediaLanguageOverrides)
        .where(
          and(
            eq(mediaLanguageOverrides.userId, ctx.userId),
            eq(mediaLanguageOverrides.mediaType, input.mediaType),
            eq(mediaLanguageOverrides.mediaId, input.mediaId)
          )
        );

      return { success: true };
    }),

  // ===========================================================================
  // Session State
  // ===========================================================================

  /**
   * Get session state for a show (for binge-watching continuity).
   */
  getSessionState: protectedProcedure
    .input(z.object({ showId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const state = await ctx.db.query.playbackSessionState.findFirst({
        where: and(
          eq(playbackSessionState.userId, ctx.userId),
          eq(playbackSessionState.showId, input.showId)
        ),
      });

      if (!state) {
        return null;
      }

      // Check if session has expired
      const expiresAt = new Date(state.expiresAt);
      if (expiresAt < new Date()) {
        // Session expired, clean it up
        await ctx.db
          .delete(playbackSessionState)
          .where(
            and(
              eq(playbackSessionState.userId, ctx.userId),
              eq(playbackSessionState.showId, input.showId)
            )
          );
        return null;
      }

      return {
        lastAudioLanguage: state.lastAudioLanguage,
        lastSubtitleLanguage: state.lastSubtitleLanguage,
        wasExplicitChange: state.wasExplicitChange,
      };
    }),

  /**
   * Update session state after track selection.
   */
  updateSessionState: protectedProcedure
    .input(
      z.object({
        showId: uuidSchema,
        audioLanguage: z.string().nullable(),
        subtitleLanguage: z.string().nullable(),
        wasExplicitChange: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Session expires after 4 hours of inactivity
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

      const existing = await ctx.db.query.playbackSessionState.findFirst({
        where: and(
          eq(playbackSessionState.userId, ctx.userId),
          eq(playbackSessionState.showId, input.showId)
        ),
      });

      if (existing) {
        await ctx.db
          .update(playbackSessionState)
          .set({
            lastAudioLanguage: input.audioLanguage,
            lastSubtitleLanguage: input.subtitleLanguage,
            wasExplicitChange: input.wasExplicitChange,
            lastActivityAt: new Date().toISOString(),
            expiresAt,
          })
          .where(
            and(
              eq(playbackSessionState.userId, ctx.userId),
              eq(playbackSessionState.showId, input.showId)
            )
          );
      } else {
        await ctx.db.insert(playbackSessionState).values({
          userId: ctx.userId,
          showId: input.showId,
          lastAudioLanguage: input.audioLanguage,
          lastSubtitleLanguage: input.subtitleLanguage,
          wasExplicitChange: input.wasExplicitChange,
          expiresAt,
        });
      }

      return { success: true };
    }),

  /**
   * Clear session state for a show.
   */
  clearSessionState: protectedProcedure
    .input(z.object({ showId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(playbackSessionState)
        .where(
          and(
            eq(playbackSessionState.userId, ctx.userId),
            eq(playbackSessionState.showId, input.showId)
          )
        );

      return { success: true };
    }),

  // ===========================================================================
  // Track Selection
  // ===========================================================================

  /**
   * Select the best audio and subtitle tracks for a media item.
   *
   * This considers: session state > per-media override > matching rules > global preferences.
   * Returns the selected track IDs along with mismatch information.
   */
  selectTracks: protectedProcedure
    .input(
      z.object({
        mediaType: z.enum(['movie', 'episode']),
        mediaId: uuidSchema,
        showId: uuidSchema.optional(), // Required for episodes
      })
    )
    .query(async ({ ctx, input }) => {
      const result = await selectTracks(
        ctx.db,
        ctx.userId,
        input.mediaType,
        input.mediaId,
        input.showId
      );

      return {
        audioTrackId: result.audioTrackId,
        subtitleTrackId: result.subtitleTrackId,
        forcedSubtitleTrackId: result.forcedSubtitleTrackId,
        audioMismatch: result.audioMismatch,
        subtitleMismatch: result.subtitleMismatch,
        audioLanguageUsed: result.audioLanguageUsed,
        subtitleLanguageUsed: result.subtitleLanguageUsed,
      };
    }),

  // ===========================================================================
  // Available Languages
  // ===========================================================================

  /**
   * Get all distinct audio languages available in the library.
   */
  getAvailableAudioLanguages: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .selectDistinct({
        language: audioTracks.language,
        languageName: audioTracks.languageName,
      })
      .from(audioTracks)
      .where(sql`${audioTracks.language} IS NOT NULL AND ${audioTracks.language} != ''`)
      .orderBy(asc(audioTracks.languageName));

    return results.map((r) => ({
      code: r.language!,
      name: r.languageName ?? r.language!,
    }));
  }),

  /**
   * Get all distinct subtitle languages available in the library.
   */
  getAvailableSubtitleLanguages: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .selectDistinct({
        language: subtitleTracks.language,
        languageName: subtitleTracks.languageName,
      })
      .from(subtitleTracks)
      .where(sql`${subtitleTracks.language} IS NOT NULL AND ${subtitleTracks.language} != ''`)
      .orderBy(asc(subtitleTracks.languageName));

    return results.map((r) => ({
      code: r.language!,
      name: r.languageName ?? r.language!,
    }));
  }),
});

