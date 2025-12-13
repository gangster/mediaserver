/**
 * Language Rules Editor Component
 *
 * Allows users to create, edit, and manage language rules for automatic
 * audio and subtitle track selection.
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useLanguageRules,
  useCreateLanguageRule,
  useUpdateLanguageRule,
  useDeleteLanguageRule,
  useToggleLanguageRule,
  type LanguageRule,
  type SubtitleMode,
} from '@mediaserver/api-client';

// Common language options for rules
const LANGUAGE_OPTIONS = [
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
];

const SUBTITLE_MODE_LABELS: Record<SubtitleMode, string> = {
  off: 'Off',
  auto: 'Auto',
  always: 'Always',
  foreign_only: 'Foreign Only',
};

interface LanguageRulesEditorProps {
  onClose?: () => void;
}

export function LanguageRulesEditor({ onClose: _onClose }: LanguageRulesEditorProps) {
  const { data: rules, isLoading } = useLanguageRules();
  const [editingRule, setEditingRule] = useState<LanguageRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const toggleRule = useToggleLanguageRule();
  const deleteRule = useDeleteLanguageRule();

  const handleToggle = useCallback(
    async (rule: LanguageRule) => {
      await toggleRule.mutateAsync({ id: rule.id, enabled: !rule.enabled });
    },
    [toggleRule]
  );

  const handleDelete = useCallback(
    async (rule: LanguageRule) => {
      if (rule.isBuiltIn) {
        return; // Can't delete built-in rules
      }
      await deleteRule.mutateAsync({ id: rule.id });
    },
    [deleteRule]
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Language Rules</Text>
          <Text style={styles.subtitle}>
            Rules are applied in priority order to automatically select tracks
          </Text>
        </View>
        <Pressable
          onPress={() => setIsCreating(true)}
          style={styles.addButton}
        >
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Rule</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.rulesList}>
        {rules?.map((rule: LanguageRule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onEdit={() => setEditingRule(rule)}
            onToggle={() => handleToggle(rule)}
            onDelete={() => handleDelete(rule)}
          />
        ))}

        {rules?.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="list-outline" size={48} color="#52525b" />
            <Text style={styles.emptyStateText}>No language rules yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Create rules to automatically select the right audio and subtitle tracks
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Edit/Create Modal */}
      <RuleEditorModal
        visible={editingRule !== null || isCreating}
        rule={editingRule}
        onClose={() => {
          setEditingRule(null);
          setIsCreating(false);
        }}
      />
    </View>
  );
}

// =============================================================================
// Rule Card Component
// =============================================================================

function RuleCard({
  rule,
  onEdit,
  onToggle,
  onDelete,
}: {
  rule: LanguageRule;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.ruleCard, !rule.enabled && styles.ruleCardDisabled]}>
      <View style={styles.ruleCardHeader}>
        <View style={styles.ruleCardTitleRow}>
          <Text style={[styles.ruleCardTitle, !rule.enabled && styles.ruleCardTitleDisabled]}>
            {rule.name}
          </Text>
          {rule.isBuiltIn && (
            <View style={styles.builtInBadge}>
              <Text style={styles.builtInBadgeText}>Built-in</Text>
            </View>
          )}
        </View>
        <View style={styles.ruleCardActions}>
          <Pressable onPress={onToggle} style={styles.toggleButton}>
            <Ionicons
              name={rule.enabled ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={rule.enabled ? '#22c55e' : '#71717a'}
            />
          </Pressable>
          <Pressable onPress={onEdit} style={styles.editButton}>
            <Ionicons name="pencil" size={16} color="#a1a1aa" />
          </Pressable>
          {!rule.isBuiltIn && (
            <Pressable onPress={onDelete} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.ruleCardDetails}>
        <View style={styles.ruleDetailRow}>
          <Text style={styles.ruleDetailLabel}>Priority:</Text>
          <Text style={styles.ruleDetailValue}>{rule.priority}</Text>
        </View>
        <View style={styles.ruleDetailRow}>
          <Text style={styles.ruleDetailLabel}>Audio:</Text>
          <Text style={styles.ruleDetailValue}>
            {rule.audioLanguages.map((c) => getLanguageName(c)).join(' → ')}
          </Text>
        </View>
        <View style={styles.ruleDetailRow}>
          <Text style={styles.ruleDetailLabel}>Subtitles:</Text>
          <Text style={styles.ruleDetailValue}>
            {rule.subtitleLanguages.map((c) => getLanguageName(c)).join(' → ')}
            {rule.subtitleMode && ` (${SUBTITLE_MODE_LABELS[rule.subtitleMode]})`}
          </Text>
        </View>

        {rule.conditions && Object.keys(rule.conditions).length > 0 && (
          <View style={styles.conditionsBox}>
            <Text style={styles.conditionsLabel}>Conditions:</Text>
            {rule.conditions.genres && rule.conditions.genres.length > 0 && (
              <Text style={styles.conditionItem}>
                Genres: {rule.conditions.genres.join(', ')}
              </Text>
            )}
            {rule.conditions.originalLanguages && rule.conditions.originalLanguages.length > 0 && (
              <Text style={styles.conditionItem}>
                Original Language: {rule.conditions.originalLanguages.map(getLanguageName).join(', ')}
              </Text>
            )}
            {rule.conditions.originCountries && rule.conditions.originCountries.length > 0 && (
              <Text style={styles.conditionItem}>
                Origin: {rule.conditions.originCountries.join(', ')}
              </Text>
            )}
            {rule.conditions.keywords && rule.conditions.keywords.length > 0 && (
              <Text style={styles.conditionItem}>
                Keywords: {rule.conditions.keywords.join(', ')}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// Rule Editor Modal
// =============================================================================

function RuleEditorModal({
  visible,
  rule,
  onClose,
}: {
  visible: boolean;
  rule: LanguageRule | null;
  onClose: () => void;
}) {
  const isEditing = rule !== null;
  const createRule = useCreateLanguageRule();
  const updateRule = useUpdateLanguageRule();

  const [name, setName] = useState(rule?.name ?? '');
  const [priority, setPriority] = useState(rule?.priority ?? 100);
  const [audioLanguages, setAudioLanguages] = useState<string[]>(rule?.audioLanguages ?? ['eng']);
  const [subtitleLanguages, setSubtitleLanguages] = useState<string[]>(rule?.subtitleLanguages ?? ['eng']);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode | null>(rule?.subtitleMode ?? null);
  const [genres, setGenres] = useState<string[]>(rule?.conditions.genres ?? []);

  // Reset state when rule changes
  const handleSave = useCallback(async () => {
    const conditions = {
      genres: genres.length > 0 ? genres : undefined,
    };

    if (isEditing && rule) {
      await updateRule.mutateAsync({
        id: rule.id,
        name,
        priority,
        conditions,
        audioLanguages,
        subtitleLanguages,
        subtitleMode: subtitleMode ?? undefined,
      });
    } else {
      await createRule.mutateAsync({
        name,
        priority,
        conditions,
        audioLanguages,
        subtitleLanguages,
        subtitleMode: subtitleMode ?? undefined,
      });
    }
    onClose();
  }, [isEditing, rule, name, priority, genres, audioLanguages, subtitleLanguages, subtitleMode, updateRule, createRule, onClose]);

  const isPending = createRule.isPending || updateRule.isPending;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEditing ? 'Edit Rule' : 'Create Rule'}
            </Text>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#a1a1aa" />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Rule Name</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Enter rule name..."
                placeholderTextColor="#52525b"
              />
            </View>

            {/* Priority */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Priority (lower = higher priority)</Text>
              <View style={styles.priorityButtons}>
                {[10, 50, 100, 200].map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
                    style={[styles.priorityButton, priority === p && styles.priorityButtonSelected]}
                  >
                    <Text style={[styles.priorityButtonText, priority === p && styles.priorityButtonTextSelected]}>
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Audio Languages */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Audio Languages (in fallback order)</Text>
              <View style={styles.languageSelector}>
                {LANGUAGE_OPTIONS.map((lang) => {
                  const isSelected = audioLanguages.includes(lang.code);
                  return (
                    <Pressable
                      key={lang.code}
                      onPress={() => {
                        if (isSelected) {
                          setAudioLanguages((prev) => prev.filter((c) => c !== lang.code));
                        } else {
                          setAudioLanguages((prev) => [...prev, lang.code]);
                        }
                      }}
                      style={[styles.languageChip, isSelected && styles.languageChipSelected]}
                    >
                      <Text style={[styles.languageChipText, isSelected && styles.languageChipTextSelected]}>
                        {lang.name}
                      </Text>
                      {isSelected && (
                        <Text style={styles.languageChipOrder}>
                          #{audioLanguages.indexOf(lang.code) + 1}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Subtitle Languages */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Subtitle Languages (in fallback order)</Text>
              <View style={styles.languageSelector}>
                {LANGUAGE_OPTIONS.map((lang) => {
                  const isSelected = subtitleLanguages.includes(lang.code);
                  return (
                    <Pressable
                      key={lang.code}
                      onPress={() => {
                        if (isSelected) {
                          setSubtitleLanguages((prev) => prev.filter((c) => c !== lang.code));
                        } else {
                          setSubtitleLanguages((prev) => [...prev, lang.code]);
                        }
                      }}
                      style={[styles.languageChip, isSelected && styles.languageChipSelected]}
                    >
                      <Text style={[styles.languageChipText, isSelected && styles.languageChipTextSelected]}>
                        {lang.name}
                      </Text>
                      {isSelected && (
                        <Text style={styles.languageChipOrder}>
                          #{subtitleLanguages.indexOf(lang.code) + 1}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Subtitle Mode */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Subtitle Mode (optional override)</Text>
              <View style={styles.subtitleModeButtons}>
                {(['auto', 'always', 'foreign_only', 'off'] as SubtitleMode[]).map((mode) => (
                  <Pressable
                    key={mode}
                    onPress={() => setSubtitleMode(subtitleMode === mode ? null : mode)}
                    style={[styles.modeButton, subtitleMode === mode && styles.modeButtonSelected]}
                  >
                    <Text style={[styles.modeButtonText, subtitleMode === mode && styles.modeButtonTextSelected]}>
                      {SUBTITLE_MODE_LABELS[mode]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Conditions - Genres */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Match Genres (optional)</Text>
              <View style={styles.genreSelector}>
                {['Anime', 'Animation', 'Documentary', 'Foreign', 'Action', 'Drama', 'Comedy'].map((genre) => {
                  const isSelected = genres.includes(genre);
                  return (
                    <Pressable
                      key={genre}
                      onPress={() => {
                        if (isSelected) {
                          setGenres((prev) => prev.filter((g) => g !== genre));
                        } else {
                          setGenres((prev) => [...prev, genre]);
                        }
                      }}
                      style={[styles.genreChip, isSelected && styles.genreChipSelected]}
                    >
                      <Text style={[styles.genreChipText, isSelected && styles.genreChipTextSelected]}>
                        {genre}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={isPending || !name || audioLanguages.length === 0 || subtitleLanguages.length === 0}
              style={[styles.saveButton, isPending && styles.saveButtonDisabled]}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isEditing ? 'Save Changes' : 'Create Rule'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getLanguageName(code: string): string {
  const lang = LANGUAGE_OPTIONS.find((l) => l.code === code);
  return lang?.name ?? code.toUpperCase();
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#71717a',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#818cf8',
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  rulesList: {
    flex: 1,
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#71717a',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
  },

  // Rule Card
  ruleCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 12,
    overflow: 'hidden',
  },
  ruleCardDisabled: {
    opacity: 0.6,
  },
  ruleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  ruleCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  ruleCardTitleDisabled: {
    color: '#71717a',
  },
  builtInBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    borderRadius: 4,
  },
  builtInBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#818cf8',
    textTransform: 'uppercase',
  },
  ruleCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleButton: {
    padding: 4,
  },
  editButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  ruleCardDetails: {
    padding: 16,
  },
  ruleDetailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  ruleDetailLabel: {
    fontSize: 13,
    color: '#71717a',
    width: 80,
  },
  ruleDetailValue: {
    flex: 1,
    fontSize: 13,
    color: '#d4d4d8',
  },
  conditionsBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#09090b',
    borderRadius: 8,
  },
  conditionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  conditionItem: {
    fontSize: 12,
    color: '#71717a',
    marginBottom: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
    backgroundColor: '#18181b',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#a1a1aa',
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#818cf8',
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Form
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#a1a1aa',
    marginBottom: 8,
  },
  textInput: {
    padding: 12,
    backgroundColor: '#09090b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    fontSize: 14,
    color: '#ffffff',
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#27272a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  priorityButtonSelected: {
    borderColor: '#818cf8',
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
  },
  priorityButtonText: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  priorityButtonTextSelected: {
    color: '#ffffff',
  },
  languageSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#27272a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  languageChipSelected: {
    borderColor: '#818cf8',
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
  },
  languageChipText: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  languageChipTextSelected: {
    color: '#ffffff',
  },
  languageChipOrder: {
    fontSize: 10,
    color: '#818cf8',
    fontWeight: '600',
  },
  subtitleModeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#27272a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeButtonSelected: {
    borderColor: '#818cf8',
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
  },
  modeButtonText: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  modeButtonTextSelected: {
    color: '#ffffff',
  },
  genreSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#27272a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  genreChipSelected: {
    borderColor: '#f472b6',
    backgroundColor: 'rgba(244, 114, 182, 0.1)',
  },
  genreChipText: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  genreChipTextSelected: {
    color: '#f472b6',
  },
});

export default LanguageRulesEditor;

