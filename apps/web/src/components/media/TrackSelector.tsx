/**
 * Unified Track Selector Component
 *
 * Displays audio and subtitle track selection with intelligent defaults
 * based on user preferences, language rules, and session state.
 *
 * Shows mismatch warnings when preferred tracks aren't available.
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useTrackSelection,
  useMovieAudioTracks,
  useEpisodeAudioTracks,
  useMovieSubtitles,
  useEpisodeSubtitles,
  useUpdateSessionState,
  type AudioTrack,
  type SubtitleTrack,
} from '@mediaserver/api-client';

interface TrackSelectorProps {
  mediaType: 'movie' | 'episode';
  mediaId: string;
  showId?: string; // Required for episodes, determines session state scope
  onAudioChange?: (trackId: string | null) => void;
  onSubtitleChange?: (trackId: string | null) => void;
  compact?: boolean;
}

export function TrackSelector({
  mediaType,
  mediaId,
  showId,
  onAudioChange,
  onSubtitleChange,
  compact = false,
}: TrackSelectorProps) {
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);

  // Fetch track selection and available tracks
  const { data: selection, isLoading: selectionLoading } = useTrackSelection(
    mediaType,
    mediaId,
    showId,
    !!mediaId
  );

  const { data: audioTracks } = mediaType === 'movie'
    ? useMovieAudioTracks(mediaId)
    : useEpisodeAudioTracks(mediaId);

  const { data: subtitleTracks } = mediaType === 'movie'
    ? useMovieSubtitles(mediaId)
    : useEpisodeSubtitles(mediaId);

  const updateSessionState = useUpdateSessionState();
  // Note: setMediaOverride is available for future use when we add "remember for this show" feature
  // const setMediaOverride = useSetMediaLanguageOverride();

  // Get currently selected tracks
  const selectedAudioTrack = useMemo(
    () => audioTracks?.find((t: AudioTrack) => t.id === selection?.audioTrackId) ?? null,
    [audioTracks, selection?.audioTrackId]
  );

  const selectedSubtitleTrack = useMemo(
    () => subtitleTracks?.find((t: SubtitleTrack) => t.id === selection?.subtitleTrackId) ?? null,
    [subtitleTracks, selection?.subtitleTrackId]
  );

  // Handle track changes
  const handleAudioSelect = useCallback(
    async (track: AudioTrack | null) => {
      setShowAudioModal(false);
      onAudioChange?.(track?.id ?? null);

      // Update session state for binge-watching continuity
      if (showId && track) {
        await updateSessionState.mutateAsync({
          showId,
          audioLanguage: track.language ?? null,
          subtitleLanguage: selection?.subtitleLanguageUsed ?? null,
          wasExplicitChange: true,
        });
      }
    },
    [showId, updateSessionState, selection?.subtitleLanguageUsed, onAudioChange]
  );

  const handleSubtitleSelect = useCallback(
    async (track: SubtitleTrack | null) => {
      setShowSubtitleModal(false);
      onSubtitleChange?.(track?.id ?? null);

      // Update session state for binge-watching continuity
      if (showId) {
        await updateSessionState.mutateAsync({
          showId,
          audioLanguage: selection?.audioLanguageUsed ?? null,
          subtitleLanguage: track?.language ?? null,
          wasExplicitChange: true,
        });
      }
    },
    [showId, updateSessionState, selection?.audioLanguageUsed, onSubtitleChange]
  );

  if (selectionLoading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="small" color="#818cf8" />
      </View>
    );
  }

  if (!audioTracks?.length && !subtitleTracks?.length) {
    return null; // No tracks available
  }

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Audio Track Selector */}
      {audioTracks && audioTracks.length > 0 && (
        <View style={styles.trackSection}>
          <Pressable
            onPress={() => setShowAudioModal(true)}
            style={styles.trackButton}
          >
            <View style={styles.trackButtonContent}>
              <Ionicons name="volume-high" size={16} color="#a1a1aa" />
              <Text style={styles.trackButtonLabel}>Audio</Text>
              <Text style={styles.trackButtonValue}>
                {selectedAudioTrack
                  ? formatAudioTrackName(selectedAudioTrack)
                  : 'None'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#71717a" />
          </Pressable>

          {selection?.audioMismatch && (
            <View style={styles.mismatchWarning}>
              <Ionicons name="warning" size={12} color="#f59e0b" />
              <Text style={styles.mismatchText}>
                Preferred audio not available
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Subtitle Track Selector */}
      {subtitleTracks && subtitleTracks.length > 0 && (
        <View style={styles.trackSection}>
          <Pressable
            onPress={() => setShowSubtitleModal(true)}
            style={styles.trackButton}
          >
            <View style={styles.trackButtonContent}>
              <Ionicons name="text" size={16} color="#a1a1aa" />
              <Text style={styles.trackButtonLabel}>Subtitles</Text>
              <Text style={styles.trackButtonValue}>
                {selectedSubtitleTrack
                  ? formatSubtitleTrackName(selectedSubtitleTrack)
                  : 'Off'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#71717a" />
          </Pressable>

          {selection?.subtitleMismatch && (
            <View style={styles.mismatchWarning}>
              <Ionicons name="warning" size={12} color="#f59e0b" />
              <Text style={styles.mismatchText}>
                Preferred subtitles not available
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Audio Track Modal */}
      <TrackModal
        visible={showAudioModal}
        title="Audio Track"
        onClose={() => setShowAudioModal(false)}
      >
        <AudioTrackList
          tracks={audioTracks ?? []}
          selectedId={selection?.audioTrackId ?? null}
          onSelect={handleAudioSelect}
        />
      </TrackModal>

      {/* Subtitle Track Modal */}
      <TrackModal
        visible={showSubtitleModal}
        title="Subtitles"
        onClose={() => setShowSubtitleModal(false)}
      >
        <SubtitleTrackList
          tracks={subtitleTracks ?? []}
          selectedId={selection?.subtitleTrackId ?? null}
          onSelect={handleSubtitleSelect}
        />
      </TrackModal>
    </View>
  );
}

// =============================================================================
// Audio Track List
// =============================================================================

function AudioTrackList({
  tracks,
  selectedId,
  onSelect,
}: {
  tracks: AudioTrack[];
  selectedId: string | null;
  onSelect: (track: AudioTrack | null) => void;
}) {
  // Group by language for easier selection
  const grouped = useMemo(() => {
    const byLanguage: Record<string, AudioTrack[]> = {};
    for (const track of tracks) {
      const lang = track.language ?? 'und';
      if (!byLanguage[lang]) {
        byLanguage[lang] = [];
      }
      byLanguage[lang]!.push(track);
    }
    return byLanguage;
  }, [tracks]);

  return (
    <ScrollView style={styles.trackList}>
      {Object.entries(grouped).map(([lang, langTracks]) => (
        <View key={lang} style={styles.trackGroup}>
          <Text style={styles.trackGroupLabel}>
            {langTracks[0]?.languageName ?? lang.toUpperCase()}
          </Text>
          {langTracks.map((track) => (
            <Pressable
              key={track.id}
              onPress={() => onSelect(track)}
              style={[
                styles.trackOption,
                selectedId === track.id && styles.trackOptionSelected,
              ]}
            >
              <View style={styles.trackOptionInfo}>
                <Text style={styles.trackOptionTitle}>
                  {formatAudioTrackDetails(track)}
                </Text>
                {track.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
                {track.isOriginal && (
                  <View style={styles.originalBadge}>
                    <Text style={styles.originalBadgeText}>Original</Text>
                  </View>
                )}
              </View>
              {selectedId === track.id && (
                <Ionicons name="checkmark" size={18} color="#818cf8" />
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// =============================================================================
// Subtitle Track List
// =============================================================================

function SubtitleTrackList({
  tracks,
  selectedId,
  onSelect,
}: {
  tracks: SubtitleTrack[];
  selectedId: string | null;
  onSelect: (track: SubtitleTrack | null) => void;
}) {
  // Group by language for easier selection
  const grouped = useMemo(() => {
    const byLanguage: Record<string, SubtitleTrack[]> = {};
    for (const track of tracks) {
      const lang = track.language ?? 'und';
      if (!byLanguage[lang]) {
        byLanguage[lang] = [];
      }
      byLanguage[lang]!.push(track);
    }
    return byLanguage;
  }, [tracks]);

  return (
    <ScrollView style={styles.trackList}>
      {/* Off option */}
      <Pressable
        onPress={() => onSelect(null)}
        style={[
          styles.trackOption,
          selectedId === null && styles.trackOptionSelected,
        ]}
      >
        <Text style={styles.trackOptionTitle}>Off</Text>
        {selectedId === null && (
          <Ionicons name="checkmark" size={18} color="#818cf8" />
        )}
      </Pressable>

      {Object.entries(grouped).map(([lang, langTracks]) => (
        <View key={lang} style={styles.trackGroup}>
          <Text style={styles.trackGroupLabel}>
            {langTracks[0]?.languageName ?? lang.toUpperCase()}
          </Text>
          {langTracks.map((track) => (
            <Pressable
              key={track.id}
              onPress={() => onSelect(track)}
              style={[
                styles.trackOption,
                selectedId === track.id && styles.trackOptionSelected,
              ]}
            >
              <View style={styles.trackOptionInfo}>
                <Text style={styles.trackOptionTitle}>
                  {formatSubtitleTrackDetails(track)}
                </Text>
                <View style={styles.badgeRow}>
                  {track.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                  {track.isForced && (
                    <View style={styles.forcedBadge}>
                      <Text style={styles.forcedBadgeText}>Forced</Text>
                    </View>
                  )}
                  {track.isSdh && (
                    <View style={styles.sdhBadge}>
                      <Text style={styles.sdhBadgeText}>SDH</Text>
                    </View>
                  )}
                  {track.isCc && (
                    <View style={styles.ccBadge}>
                      <Text style={styles.ccBadgeText}>CC</Text>
                    </View>
                  )}
                </View>
              </View>
              {selectedId === track.id && (
                <Ionicons name="checkmark" size={18} color="#818cf8" />
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// =============================================================================
// Track Modal
// =============================================================================

function TrackModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#a1a1aa" />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatAudioTrackName(track: AudioTrack): string {
  let name = track.languageName ?? track.language ?? 'Unknown';
  if (track.channelLayout) {
    name += ` (${track.channelLayout})`;
  }
  return name;
}

function formatAudioTrackDetails(track: AudioTrack): string {
  const parts: string[] = [];

  if (track.channelLayout) {
    parts.push(track.channelLayout);
  } else if (track.channels) {
    parts.push(`${track.channels} ch`);
  }

  if (track.codec) {
    parts.push(track.codec.toUpperCase());
  }

  if (track.title) {
    parts.push(`"${track.title}"`);
  }

  return parts.join(' • ') || track.languageName || 'Audio Track';
}

function formatSubtitleTrackName(track: SubtitleTrack): string {
  let name = track.languageName ?? track.language ?? 'Unknown';
  if (track.isSdh) {
    name += ' (SDH)';
  } else if (track.isForced) {
    name += ' (Forced)';
  }
  return name;
}

function formatSubtitleTrackDetails(track: SubtitleTrack): string {
  const parts: string[] = [];

  if (track.format) {
    parts.push(track.format.toUpperCase());
  }

  if (track.title) {
    parts.push(`"${track.title}"`);
  }

  if (track.source === 'external') {
    parts.push('External');
  }

  return parts.join(' • ') || track.languageName || 'Subtitle Track';
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#18181b',
    borderRadius: 8,
  },
  containerCompact: {
    padding: 8,
    gap: 8,
  },

  // Track Section
  trackSection: {
    flex: 1,
    minWidth: 140,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#27272a',
    borderRadius: 6,
  },
  trackButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    overflow: 'hidden',
  },
  trackButtonLabel: {
    fontSize: 12,
    color: '#71717a',
  },
  trackButtonValue: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
    flex: 1,
  },
  mismatchWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  mismatchText: {
    fontSize: 11,
    color: '#f59e0b',
  },

  // Track List
  trackList: {
    maxHeight: 400,
  },
  trackGroup: {
    marginBottom: 16,
  },
  trackGroupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717a',
    marginBottom: 8,
    paddingHorizontal: 16,
    textTransform: 'uppercase',
  },
  trackOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  trackOptionSelected: {
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
  },
  trackOptionInfo: {
    flex: 1,
  },
  trackOptionTitle: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    color: '#818cf8',
    fontWeight: '600',
  },
  originalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 4,
  },
  originalBadgeText: {
    fontSize: 10,
    color: '#22c55e',
    fontWeight: '600',
  },
  forcedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderRadius: 4,
  },
  forcedBadgeText: {
    fontSize: 10,
    color: '#f97316',
    fontWeight: '600',
  },
  sdhBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 4,
  },
  sdhBadgeText: {
    fontSize: 10,
    color: '#3b82f6',
    fontWeight: '600',
  },
  ccBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderRadius: 4,
  },
  ccBadgeText: {
    fontSize: 10,
    color: '#a855f7',
    fontWeight: '600',
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
    maxWidth: 400,
    maxHeight: '70%',
    backgroundColor: '#18181b',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalCloseButton: {
    padding: 4,
  },
});

export default TrackSelector;

