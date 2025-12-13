/**
 * Playback preferences schema - unified audio and subtitle preferences.
 *
 * This replaces the old userSubtitlePreferences and userSubtitleSelections tables
 * with a more comprehensive system that handles both audio and subtitle selection
 * with support for content-based rules and per-show overrides.
 */

import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { tvShows } from './media.js';

/**
 * Subtitle mode options:
 * - off: Never show subtitles (except forced if alwaysShowForced is true)
 * - auto: Show subtitles when audio language differs from user's preferred subtitle language
 * - always: Always show subtitles
 * - foreign_only: Only show subtitles when audio is not in user's preferred audio language
 */
export type SubtitleMode = 'off' | 'auto' | 'always' | 'foreign_only';

/**
 * Audio quality preference:
 * - highest: Prefer lossless/high-bitrate codecs (TrueHD, DTS-HD MA, FLAC)
 * - balanced: Prefer mid-range codecs (EAC3, DTS, AC3)
 * - compatible: Prefer widely compatible codecs (AAC, AC3)
 */
export type AudioQualityPreference = 'highest' | 'balanced' | 'compatible';

/**
 * User playback preferences - global defaults for audio and subtitle selection.
 */
export const playbackPreferences = sqliteTable('playback_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Language preferences (JSON arrays of ISO 639-2/B codes, order = fallback priority)
  /** Preferred audio languages in order of priority (e.g., ["eng", "jpn"]) */
  audioLanguages: text('audio_languages').notNull().default('["eng"]'),
  /** Preferred subtitle languages in order of priority (e.g., ["eng"]) */
  subtitleLanguages: text('subtitle_languages').notNull().default('["eng"]'),

  // Subtitle behavior
  /** When to show subtitles */
  subtitleMode: text('subtitle_mode', {
    enum: ['off', 'auto', 'always', 'foreign_only'],
  })
    .notNull()
    .default('auto'),
  /** Always show forced subtitles even when subtitle mode is 'off' */
  alwaysShowForced: integer('always_show_forced', { mode: 'boolean' })
    .notNull()
    .default(true),
  /** Prefer SDH/CC subtitles when available */
  preferSdh: integer('prefer_sdh', { mode: 'boolean' }).notNull().default(false),

  // Audio behavior
  /** Prefer the original language audio when available */
  preferOriginalAudio: integer('prefer_original_audio', { mode: 'boolean' })
    .notNull()
    .default(false),
  /** Audio quality preference (affects codec selection when language matches) */
  audioQuality: text('audio_quality', {
    enum: ['highest', 'balanced', 'compatible'],
  })
    .notNull()
    .default('highest'),

  // Session behavior
  /** Remember track selections within a viewing session (e.g., binge-watching) */
  rememberWithinSession: integer('remember_within_session', { mode: 'boolean' })
    .notNull()
    .default(true),

  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Language rule conditions - JSON structure for matching content.
 *
 * All conditions use AND logic (all specified conditions must match).
 * Each condition array uses OR logic (any value in the array can match).
 *
 * Example:
 * {
 *   "genres": ["Animation"],
 *   "originCountries": ["JP"],
 *   "originalLanguages": ["ja"]
 * }
 * Matches content that is: Animation genre AND (from Japan OR original language is Japanese)
 */
export interface LanguageRuleConditions {
  /** Genre names to match (e.g., ["Animation", "Anime"]) */
  genres?: string[];
  /** ISO 3166-1 alpha-2 country codes (e.g., ["JP", "KR"]) */
  originCountries?: string[];
  /** ISO 639-1 language codes (e.g., ["ja", "ko"]) */
  originalLanguages?: string[];
  /** Specific library IDs to apply this rule to */
  libraryIds?: string[];
  /** Keywords to match in title (e.g., ["anime", "dubbed"]) */
  keywords?: string[];
}

/**
 * Language rules - content-based automatic track selection rules.
 *
 * Rules are evaluated in priority order (lower number = higher priority).
 * First matching rule wins.
 */
export const languageRules = sqliteTable('language_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Display name for the rule (e.g., "Anime", "K-Drama") */
  name: text('name').notNull(),
  /** Priority order (lower = evaluated first, 0-99 for built-in, 100+ for custom) */
  priority: integer('priority').notNull().default(100),
  /** Whether this is a built-in rule (editable but not deletable) */
  isBuiltIn: integer('is_built_in', { mode: 'boolean' }).notNull().default(false),
  /** Whether this rule is active */
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

  /** Match conditions (JSON - see LanguageRuleConditions interface) */
  conditions: text('conditions').notNull(),

  /** Audio languages to try, in fallback order (JSON array of ISO 639-2/B codes) */
  audioLanguages: text('audio_languages').notNull(),
  /** Subtitle languages to try, in fallback order (JSON array of ISO 639-2/B codes) */
  subtitleLanguages: text('subtitle_languages').notNull(),
  /** Override subtitle mode for matching content (null = use global default) */
  subtitleMode: text('subtitle_mode', {
    enum: ['off', 'auto', 'always', 'foreign_only'],
  }),

  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Media language overrides - explicit per-show or per-movie preferences.
 *
 * These take precedence over rules and global preferences.
 * Created when user clicks "Remember for this show" after changing tracks.
 */
export const mediaLanguageOverrides = sqliteTable(
  'media_language_overrides',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Type of media (show-level for TV, movie-level for films) */
    mediaType: text('media_type', { enum: ['movie', 'show'] }).notNull(),
    /** ID of the movie or TV show */
    mediaId: text('media_id').notNull(),

    /** Override audio languages (null = use rules/global) */
    audioLanguages: text('audio_languages'),
    /** Override subtitle languages (null = use rules/global) */
    subtitleLanguages: text('subtitle_languages'),
    /** Override subtitle mode (null = use rules/global) */
    subtitleMode: text('subtitle_mode', {
      enum: ['off', 'auto', 'always', 'foreign_only'],
    }),

    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.mediaType, table.mediaId] }),
  })
);

/**
 * Playback session state - temporary within-session track preferences.
 *
 * Stores the last successful track selection during a viewing session
 * (e.g., binge-watching a show). Expires after inactivity.
 *
 * This enables: "User selected Japanese audio for ep 1, use Japanese for ep 2"
 * without creating a permanent override.
 */
export const playbackSessionState = sqliteTable(
  'playback_session_state',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Show ID for TV content, null for movies (movies don't have session continuity) */
    showId: text('show_id').references(() => tvShows.id, { onDelete: 'cascade' }),

    /** Last successfully selected audio language */
    lastAudioLanguage: text('last_audio_language'),
    /** Last successfully selected subtitle language (null = subtitles off) */
    lastSubtitleLanguage: text('last_subtitle_language'),
    /** Whether the last selection was an explicit user change (vs auto-selected) */
    wasExplicitChange: integer('was_explicit_change', { mode: 'boolean' })
      .notNull()
      .default(false),

    /** When this session state was last updated */
    lastActivityAt: text('last_activity_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    /** When this session state expires (default: 4 hours from last activity) */
    expiresAt: text('expires_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.showId] }),
  })
);

