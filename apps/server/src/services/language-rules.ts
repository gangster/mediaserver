/**
 * Language Rules Service
 *
 * Handles seeding built-in language rules for users.
 */

import { type Database, languageRules } from '@mediaserver/db';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger.js';

const log = logger.child({ service: 'language-rules' });

/**
 * Built-in language rule definitions.
 *
 * These rules are created for each new user and provide sensible defaults
 * for common content types. Users can enable/disable or modify them,
 * but cannot delete them.
 */
const BUILT_IN_RULES = [
  {
    name: 'Anime',
    priority: 10,
    conditions: {
      genres: ['Animation', 'Anime'],
      originCountries: ['JP'],
      originalLanguages: ['ja'],
    },
    audioLanguages: ['jpn', 'eng'],
    subtitleLanguages: ['eng', 'jpn'],
    subtitleMode: 'auto' as const,
  },
  {
    name: 'K-Drama',
    priority: 20,
    conditions: {
      originCountries: ['KR'],
      originalLanguages: ['ko'],
    },
    audioLanguages: ['kor', 'eng'],
    subtitleLanguages: ['eng', 'kor'],
    subtitleMode: 'always' as const,
  },
  {
    name: 'Foreign Film',
    priority: 30,
    conditions: {
      // Matches content NOT from English-speaking countries
      // We can't express "NOT IN" in the rule conditions easily,
      // so this rule is more of a template that users should customize
      originCountries: ['FR', 'DE', 'IT', 'ES', 'SE', 'NO', 'DK', 'RU', 'CN', 'TW', 'HK', 'IN', 'MX', 'BR', 'AR'],
    },
    // Prefer original audio for foreign films
    audioLanguages: ['eng'], // Falls back to English if original not available
    subtitleLanguages: ['eng'],
    subtitleMode: 'foreign_only' as const,
  },
];

/**
 * Seed built-in language rules for a user.
 *
 * Should be called when a new user is created.
 * Rules are created as disabled by default - users can enable them if they want.
 */
export async function seedBuiltInRules(db: Database, userId: string): Promise<void> {
  log.info({ userId }, 'Seeding built-in language rules');

  for (const rule of BUILT_IN_RULES) {
    try {
      await db.insert(languageRules).values({
        id: nanoid(),
        userId,
        name: rule.name,
        priority: rule.priority,
        isBuiltIn: true,
        enabled: false, // Disabled by default - user opts in
        conditions: JSON.stringify(rule.conditions),
        audioLanguages: JSON.stringify(rule.audioLanguages),
        subtitleLanguages: JSON.stringify(rule.subtitleLanguages),
        subtitleMode: rule.subtitleMode,
      });

      log.debug({ userId, ruleName: rule.name }, 'Created built-in rule');
    } catch (error) {
      // Rule might already exist (e.g., if seeding is called multiple times)
      log.warn({ error, userId, ruleName: rule.name }, 'Failed to create built-in rule (may already exist)');
    }
  }
}

/**
 * Get the number of built-in rules defined.
 */
export function getBuiltInRuleCount(): number {
  return BUILT_IN_RULES.length;
}

/**
 * Get the names of built-in rules.
 */
export function getBuiltInRuleNames(): string[] {
  return BUILT_IN_RULES.map((r) => r.name);
}

