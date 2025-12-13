/**
 * Language Preferences Component
 *
 * Allows users to configure their unified audio and subtitle preferences
 * including language fallback chains, subtitle modes, and quality settings.
 *
 * Design principles:
 * - Auto-save: Changes save automatically, no save button needed
 * - No collapsing: All settings visible by default for easy scanning
 * - Touch-friendly: Large tap targets for mobile/TV compatibility
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  usePlaybackPreferences,
  useUpdatePlaybackPreferences,
  useAvailableAudioLanguages,
  useAvailableSubtitleLanguages,
  useLanguageRules,
  type SubtitleMode,
  type AudioQualityPreference,
} from '@mediaserver/api-client';
import { LanguageRulesEditor } from './LanguageRulesEditor';

interface LanguagePreferencesProps {
  compact?: boolean;
}

const SUBTITLE_MODES: { value: SubtitleMode; label: string; description: string }[] = [
  {
    value: 'off',
    label: 'Off',
    description: 'Never show subtitles',
  },
  {
    value: 'auto',
    label: 'Auto',
    description: 'Show when audio differs from preferred language',
  },
  {
    value: 'always',
    label: 'Always',
    description: 'Always show subtitles',
  },
  {
    value: 'foreign_only',
    label: 'Foreign Only',
    description: 'Only for foreign dialogue',
  },
];

const AUDIO_QUALITY_OPTIONS: { value: AudioQualityPreference; label: string; description: string }[] = [
  {
    value: 'highest',
    label: 'Highest',
    description: 'TrueHD, DTS-HD MA, FLAC',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'EAC3, DTS, AC3',
  },
  {
    value: 'compatible',
    label: 'Compatible',
    description: 'AAC, AC3',
  },
];

// Common language options
const COMMON_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
  { code: 'zho', name: 'Chinese' },
  { code: 'rus', name: 'Russian' },
  { code: 'ara', name: 'Arabic' },
  { code: 'hin', name: 'Hindi' },
];

// Debounce delay for auto-save (ms)
const AUTO_SAVE_DELAY = 800;

export function LanguagePreferences({ compact = false }: LanguagePreferencesProps) {
  const { data: preferences, isLoading: prefsLoading } = usePlaybackPreferences();
  const { data: availableAudioLangs } = useAvailableAudioLanguages();
  const { data: availableSubLangs } = useAvailableSubtitleLanguages();
  const { data: rules } = useLanguageRules();
  const updatePreferences = useUpdatePlaybackPreferences();

  // Local state for editing
  const [audioLanguages, setAudioLanguages] = useState<string[]>(['eng']);
  const [subtitleLanguages, setSubtitleLanguages] = useState<string[]>(['eng']);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('auto');
  const [alwaysShowForced, setAlwaysShowForced] = useState(true);
  const [preferSdh, setPreferSdh] = useState(false);
  const [preferOriginalAudio, setPreferOriginalAudio] = useState(false);
  const [audioQuality, setAudioQuality] = useState<AudioQualityPreference>('highest');
  const [rememberWithinSession, setRememberWithinSession] = useState(true);
  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Debounce timer ref
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize from server preferences
  useEffect(() => {
    if (preferences && !initialized) {
      setAudioLanguages(preferences.audioLanguages);
      setSubtitleLanguages(preferences.subtitleLanguages);
      setSubtitleMode(preferences.subtitleMode);
      setAlwaysShowForced(preferences.alwaysShowForced);
      setPreferSdh(preferences.preferSdh);
      setPreferOriginalAudio(preferences.preferOriginalAudio);
      setAudioQuality(preferences.audioQuality);
      setRememberWithinSession(preferences.rememberWithinSession);
      setInitialized(true);
    }
  }, [preferences, initialized]);

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (!initialized) return;
    
    setIsSaving(true);
    try {
      await updatePreferences.mutateAsync({
        audioLanguages,
        subtitleLanguages,
        subtitleMode,
        alwaysShowForced,
        preferSdh,
        preferOriginalAudio,
        audioQuality,
        rememberWithinSession,
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    initialized,
    updatePreferences,
    audioLanguages,
    subtitleLanguages,
    subtitleMode,
    alwaysShowForced,
    preferSdh,
    preferOriginalAudio,
    audioQuality,
    rememberWithinSession,
  ]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!initialized) return;

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new timer
    saveTimerRef.current = setTimeout(() => {
      autoSave();
    }, AUTO_SAVE_DELAY);

    // Cleanup
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    initialized,
    audioLanguages,
    subtitleLanguages,
    subtitleMode,
    alwaysShowForced,
    preferSdh,
    preferOriginalAudio,
    audioQuality,
    rememberWithinSession,
    autoSave,
  ]);

  // Build language lists - combine available with common
  const audioLangOptions = buildLanguageOptions(availableAudioLangs ?? []);
  const subtitleLangOptions = buildLanguageOptions(availableSubLangs ?? []);

  const handleToggleLanguage = useCallback(
    (
      code: string,
      current: string[],
      setter: (value: string[]) => void
    ) => {
      const index = current.indexOf(code);
      if (index >= 0) {
        setter(current.filter((c) => c !== code));
      } else {
        setter([...current, code]);
      }
    },
    []
  );

  const handleMoveLanguage = useCallback(
    (
      code: string,
      direction: 'up' | 'down',
      current: string[],
      setter: (value: string[]) => void
    ) => {
      const index = current.indexOf(code);
      if (direction === 'up' && index > 0) {
        const newList = [...current];
        [newList[index - 1], newList[index]] = [newList[index]!, newList[index - 1]!];
        setter(newList);
      } else if (direction === 'down' && index < current.length - 1) {
        const newList = [...current];
        [newList[index], newList[index + 1]] = [newList[index + 1]!, newList[index]!];
        setter(newList);
      }
    },
    []
  );

  if (prefsLoading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, compact && styles.containerCompact]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header with auto-save indicator */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, compact && styles.titleCompact]}>
            Language Preferences
          </Text>
          <Text style={styles.description}>
            Configure your preferred audio and subtitle languages. Changes save automatically.
          </Text>
        </View>
        {isSaving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color="#818cf8" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </View>

      {/* Audio Languages Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="volume-high" size={20} color="#818cf8" />
          <Text style={styles.sectionTitle}>Audio</Text>
        </View>

        <View style={styles.sectionContent}>
          <ToggleOption
            label="Prefer Original Audio"
            description="When available, prefer the original language audio track"
            value={preferOriginalAudio}
            onChange={setPreferOriginalAudio}
          />

          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>Audio Quality</Text>
            <View style={styles.optionsRow}>
              {AUDIO_QUALITY_OPTIONS.map((option) => (
                <OptionChip
                  key={option.value}
                  label={option.label}
                  description={option.description}
                  selected={audioQuality === option.value}
                  onPress={() => setAudioQuality(option.value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>Preferred Languages</Text>
            <Text style={styles.optionDescription}>
              Select languages in order of preference
            </Text>
            <LanguageSelector
              languages={audioLangOptions}
              selected={audioLanguages}
              onToggle={(code) =>
                handleToggleLanguage(code, audioLanguages, setAudioLanguages)
              }
              onMove={(code, dir) =>
                handleMoveLanguage(code, dir, audioLanguages, setAudioLanguages)
              }
            />
          </View>
        </View>
      </View>

      {/* Subtitle Languages Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="text" size={20} color="#818cf8" />
          <Text style={styles.sectionTitle}>Subtitles</Text>
        </View>

        <View style={styles.sectionContent}>
          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>When to Show Subtitles</Text>
            <View style={styles.optionsRow}>
              {SUBTITLE_MODES.map((mode) => (
                <OptionChip
                  key={mode.value}
                  label={mode.label}
                  description={mode.description}
                  selected={subtitleMode === mode.value}
                  onPress={() => setSubtitleMode(mode.value)}
                />
              ))}
            </View>
          </View>

          <ToggleOption
            label="Always Show Forced Subtitles"
            description="Show forced subtitles even when subtitle mode is 'Off'"
            value={alwaysShowForced}
            onChange={setAlwaysShowForced}
          />

          <ToggleOption
            label="Prefer SDH Subtitles"
            description="Prefer subtitles for the deaf and hard of hearing"
            value={preferSdh}
            onChange={setPreferSdh}
          />

          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>Preferred Languages</Text>
            <Text style={styles.optionDescription}>
              Select languages in order of preference
            </Text>
            <LanguageSelector
              languages={subtitleLangOptions}
              selected={subtitleLanguages}
              onToggle={(code) =>
                handleToggleLanguage(code, subtitleLanguages, setSubtitleLanguages)
              }
              onMove={(code, dir) =>
                handleMoveLanguage(code, dir, subtitleLanguages, setSubtitleLanguages)
              }
            />
          </View>
        </View>
      </View>

      {/* Session Behavior Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time" size={20} color="#818cf8" />
          <Text style={styles.sectionTitle}>Playback Behavior</Text>
        </View>

        <View style={styles.sectionContent}>
          <ToggleOption
            label="Remember Within Session"
            description="When binge-watching, remember your track changes for subsequent episodes"
            value={rememberWithinSession}
            onChange={setRememberWithinSession}
          />
        </View>
      </View>

      {/* Language Rules Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="options" size={20} color="#818cf8" />
          <Text style={styles.sectionTitle}>Language Rules</Text>
        </View>

        <View style={styles.sectionContent}>
          <Text style={styles.rulesDescription}>
            Language rules automatically apply preferences based on content type
            (e.g., Anime, Foreign Films).
          </Text>

          <View style={styles.rulesPreview}>
            {rules?.filter((r: { enabled: boolean }) => r.enabled).slice(0, 3).map((rule: { id: string; name: string }) => (
              <View key={rule.id} style={styles.rulePreviewItem}>
                <View style={styles.rulePreviewDot} />
                <Text style={styles.rulePreviewName}>{rule.name}</Text>
              </View>
            ))}
            {(rules?.length ?? 0) > 3 && (
              <Text style={styles.rulesMoreText}>
                +{(rules?.length ?? 0) - 3} more rules
              </Text>
            )}
          </View>

          <Pressable
            onPress={() => setShowRulesEditor(true)}
            style={styles.manageRulesButton}
          >
            <Ionicons name="settings-outline" size={18} color="#818cf8" />
            <Text style={styles.manageRulesButtonText}>Manage Rules</Text>
            <Ionicons name="chevron-forward" size={18} color="#818cf8" />
          </Pressable>
        </View>
      </View>

      {/* Rules Editor Modal */}
      <Modal visible={showRulesEditor} animationType="slide">
        <View style={styles.rulesEditorContainer}>
          <View style={styles.rulesEditorHeader}>
            <Pressable
              onPress={() => setShowRulesEditor(false)}
              style={styles.rulesEditorCloseButton}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
              <Text style={styles.rulesEditorCloseText}>Back to Preferences</Text>
            </Pressable>
          </View>
          <LanguageRulesEditor onClose={() => setShowRulesEditor(false)} />
        </View>
      </Modal>
    </ScrollView>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function ToggleOption({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleOption}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <View style={[styles.toggle, value && styles.toggleActive]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobActive]} />
      </View>
    </Pressable>
  );
}

function OptionChip({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.optionChip, selected && styles.optionChipSelected]}
    >
      <Text style={[styles.optionChipLabel, selected && styles.optionChipLabelSelected]}>
        {label}
      </Text>
      <Text style={styles.optionChipDescription}>{description}</Text>
    </Pressable>
  );
}

function LanguageSelector({
  languages,
  selected,
  onToggle,
  onMove,
}: {
  languages: { code: string; name: string }[];
  selected: string[];
  onToggle: (code: string) => void;
  onMove: (code: string, direction: 'up' | 'down') => void;
}) {
  // Sort: selected first (in their order), then unselected alphabetically
  const sorted = [...languages].sort((a, b) => {
    const aSelected = selected.includes(a.code);
    const bSelected = selected.includes(b.code);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    if (aSelected && bSelected) {
      return selected.indexOf(a.code) - selected.indexOf(b.code);
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <View style={styles.languageList}>
      {sorted.map((lang) => {
        const isSelected = selected.includes(lang.code);
        const index = selected.indexOf(lang.code);

        return (
          <Pressable
            key={lang.code}
            onPress={() => onToggle(lang.code)}
            style={[styles.languageItem, isSelected && styles.languageItemSelected]}
          >
            <View style={[styles.languageCheckbox, isSelected && styles.languageCheckboxSelected]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
            </View>

            <Text style={[styles.languageName, isSelected && styles.languageNameSelected]}>
              {lang.name}
            </Text>

            {isSelected && (
              <View style={styles.languageControls}>
                <Text style={styles.languageOrder}>#{index + 1}</Text>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onMove(lang.code, 'up');
                  }}
                  disabled={index === 0}
                  style={[styles.orderButton, index === 0 && styles.orderButtonDisabled]}
                >
                  <Ionicons
                    name="chevron-up"
                    size={18}
                    color={index === 0 ? '#52525b' : '#a1a1aa'}
                  />
                </Pressable>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onMove(lang.code, 'down');
                  }}
                  disabled={index === selected.length - 1}
                  style={[
                    styles.orderButton,
                    index === selected.length - 1 && styles.orderButtonDisabled,
                  ]}
                >
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={index === selected.length - 1 ? '#52525b' : '#a1a1aa'}
                  />
                </Pressable>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function buildLanguageOptions(
  available: { code: string; name: string }[]
): { code: string; name: string }[] {
  // Start with common languages
  const result = [...COMMON_LANGUAGES];
  const codes = new Set(result.map((l) => l.code));

  // Add any available languages not in the common list
  for (const lang of available) {
    if (!codes.has(lang.code)) {
      result.push(lang);
      codes.add(lang.code);
    }
  }

  return result;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  containerCompact: {
    // Compact mode styles
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  titleCompact: {
    fontSize: 22,
  },
  description: {
    fontSize: 15,
    color: '#71717a',
    lineHeight: 22,
    maxWidth: 500,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    borderRadius: 16,
  },
  savingText: {
    fontSize: 13,
    color: '#818cf8',
  },

  // Section
  section: {
    marginBottom: 32,
    backgroundColor: '#18181b',
    borderRadius: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  sectionContent: {
    padding: 20,
  },

  // Toggle option (large touch targets for TV/mobile)
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    minHeight: 72, // Large touch target
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 14,
    color: '#71717a',
    lineHeight: 20,
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3f3f46',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#818cf8',
  },
  toggleKnob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },

  // Option group
  optionGroup: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#71717a',
    marginBottom: 12,
  },

  // Option chips (horizontal scrollable on mobile)
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#27272a',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 100,
  },
  optionChipSelected: {
    borderColor: '#818cf8',
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
  },
  optionChipLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#a1a1aa',
    marginBottom: 2,
  },
  optionChipLabelSelected: {
    color: '#ffffff',
  },
  optionChipDescription: {
    fontSize: 12,
    color: '#71717a',
  },

  // Language list (scrollable)
  languageList: {
    backgroundColor: '#09090b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    overflow: 'hidden',
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56, // Large touch target
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  languageItemSelected: {
    backgroundColor: 'rgba(129, 140, 248, 0.05)',
  },
  languageCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#52525b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  languageCheckboxSelected: {
    backgroundColor: '#818cf8',
    borderColor: '#818cf8',
  },
  languageName: {
    flex: 1,
    fontSize: 15,
    color: '#a1a1aa',
  },
  languageNameSelected: {
    color: '#ffffff',
    fontWeight: '500',
  },
  languageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  languageOrder: {
    fontSize: 12,
    color: '#818cf8',
    fontWeight: '600',
    marginRight: 8,
    minWidth: 24,
    textAlign: 'right',
  },
  orderButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#27272a',
  },
  orderButtonDisabled: {
    opacity: 0.4,
  },

  // Rules section
  rulesDescription: {
    fontSize: 14,
    color: '#71717a',
    lineHeight: 22,
    marginBottom: 16,
  },
  rulesPreview: {
    backgroundColor: '#09090b',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  rulePreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  rulePreviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  rulePreviewName: {
    fontSize: 14,
    color: '#d4d4d8',
  },
  rulesMoreText: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 8,
  },
  manageRulesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    minHeight: 56, // Large touch target
  },
  manageRulesButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#818cf8',
    marginLeft: 12,
  },
  rulesEditorContainer: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  rulesEditorHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    backgroundColor: '#18181b',
  },
  rulesEditorCloseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rulesEditorCloseText: {
    fontSize: 17,
    color: '#ffffff',
    fontWeight: '500',
  },
});

export default LanguagePreferences;
