/**
 * Subtitle Preferences Component
 *
 * This is now a thin wrapper around the unified LanguagePreferences component
 * that handles both audio and subtitle preferences.
 *
 * Maintained for backward compatibility with existing imports.
 */

import { LanguagePreferences } from './LanguagePreferences';

interface SubtitlePreferencesProps {
  /** Whether to show the full settings view or compact version */
  compact?: boolean;
}

export function SubtitlePreferences({ compact = false }: SubtitlePreferencesProps) {
  return <LanguagePreferences compact={compact} />;
}

export default SubtitlePreferences;
