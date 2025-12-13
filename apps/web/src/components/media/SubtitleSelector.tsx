/**
 * Subtitle Selector Component
 *
 * Displays available subtitle tracks and allows the user to select one.
 * Can be used in a video player controls overlay.
 *
 * Note: This is a simplified version that will be replaced by the unified
 * TrackSelector component which handles both audio and subtitle selection.
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useMovieSubtitles,
  useEpisodeSubtitles,
  type SubtitleTrack,
} from '@mediaserver/api-client';

interface SubtitleSelectorProps {
  /** Type of media */
  mediaType: 'movie' | 'episode';
  /** ID of the media item */
  mediaId: string;
  /** Currently selected track ID (null = off) */
  selectedTrackId: string | null;
  /** Callback when track selection changes */
  onTrackChange: (trackId: string | null) => void;
  /** Display mode: dropdown or inline list */
  mode?: 'dropdown' | 'inline';
  /** Whether to show compact view */
  compact?: boolean;
}

/** Get icon for subtitle source */
function getSourceIcon(source: string): keyof typeof Ionicons.glyphMap {
  switch (source) {
    case 'embedded':
      return 'film-outline';
    case 'external':
      return 'document-text-outline';
    default:
      return 'text-outline';
  }
}

/** Format subtitle track label */
function formatTrackLabel(track: SubtitleTrack): string {
  const parts: string[] = [];

  // Language name or title
  if (track.languageName) {
    parts.push(track.languageName);
  } else if (track.title) {
    parts.push(track.title);
  } else if (track.language) {
    parts.push(track.language.toUpperCase());
  } else {
    parts.push('Unknown');
  }

  // Add flags
  const flags: string[] = [];
  if (track.isForced) flags.push('Forced');
  if (track.isSdh) flags.push('SDH');
  if (track.isCc) flags.push('CC');
  if (track.isDefault) flags.push('Default');

  if (flags.length > 0) {
    parts.push(`(${flags.join(', ')})`);
  }

  return parts.join(' ');
}

/** Subtitle track item component */
function TrackItem({
  track,
  isSelected,
  onSelect,
  compact,
}: {
  track: SubtitleTrack;
  isSelected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.trackItem,
        isSelected && styles.trackItemSelected,
        compact && styles.trackItemCompact,
      ]}
    >
      <View style={styles.trackInfo}>
        <Ionicons
          name={getSourceIcon(track.source)}
          size={compact ? 14 : 16}
          color={isSelected ? '#818cf8' : '#a1a1aa'}
          style={styles.trackIcon}
        />
        <Text
          style={[
            styles.trackLabel,
            isSelected && styles.trackLabelSelected,
            compact && styles.trackLabelCompact,
          ]}
          numberOfLines={1}
        >
          {formatTrackLabel(track)}
        </Text>
      </View>

      <View style={styles.trackMeta}>
        <Text style={[styles.trackFormat, compact && styles.trackFormatCompact]}>
          {track.format.toUpperCase()}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark" size={compact ? 14 : 18} color="#818cf8" />
        )}
      </View>
    </Pressable>
  );
}

export function SubtitleSelector({
  mediaType,
  mediaId,
  selectedTrackId,
  onTrackChange,
  mode = 'dropdown',
  compact = false,
}: SubtitleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch subtitle tracks
  const { data: movieTracks, isLoading: movieLoading } = useMovieSubtitles(
    mediaId,
    mediaType === 'movie'
  );
  const { data: episodeTracks, isLoading: episodeLoading } = useEpisodeSubtitles(
    mediaId,
    mediaType === 'episode'
  );

  const tracks = mediaType === 'movie' ? movieTracks : episodeTracks;
  const isLoading = mediaType === 'movie' ? movieLoading : episodeLoading;

  // Group tracks by language
  const groupedTracks = useMemo(() => {
    if (!tracks) return new Map<string, SubtitleTrack[]>();

    const groups = new Map<string, SubtitleTrack[]>();
    for (const track of tracks) {
      const lang = track.languageName ?? track.language ?? 'Unknown';
      const existing = groups.get(lang) ?? [];
      existing.push(track);
      groups.set(lang, existing);
    }
    return groups;
  }, [tracks]);

  // Get currently selected track
  const selectedTrack = useMemo(() => {
    if (!selectedTrackId || !tracks) return null;
    return tracks.find((t: SubtitleTrack) => t.id === selectedTrackId) ?? null;
  }, [selectedTrackId, tracks]);

  const handleTrackSelect = useCallback(
    (trackId: string | null) => {
      onTrackChange(trackId);

      if (mode === 'dropdown') {
        setIsOpen(false);
      }
    },
    [onTrackChange, mode]
  );

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="small" color="#a1a1aa" />
      </View>
    );
  }

  if (!tracks || tracks.length === 0) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <Ionicons name="text-outline" size={compact ? 16 : 20} color="#52525b" />
        <Text style={[styles.noSubsText, compact && styles.noSubsTextCompact]}>
          No subtitles
        </Text>
      </View>
    );
  }

  // Create "Off" track option
  const offTrack: SubtitleTrack = {
    id: '',
    source: 'embedded',
    format: '',
    language: null,
    languageName: 'Off',
    title: 'Off',
    isDefault: false,
    isForced: false,
    isSdh: false,
    isCc: false,
  };

  // Dropdown mode
  if (mode === 'dropdown') {
    return (
      <View style={styles.dropdownContainer}>
        <Pressable
          onPress={toggleDropdown}
          style={[styles.dropdownButton, compact && styles.dropdownButtonCompact]}
        >
          <Ionicons
            name="text-outline"
            size={compact ? 16 : 20}
            color={selectedTrack ? '#818cf8' : '#a1a1aa'}
          />
          <Text
            style={[
              styles.dropdownLabel,
              compact && styles.dropdownLabelCompact,
              selectedTrack && styles.dropdownLabelActive,
            ]}
            numberOfLines={1}
          >
            {selectedTrack ? formatTrackLabel(selectedTrack) : 'Subtitles'}
          </Text>
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={compact ? 14 : 16}
            color="#a1a1aa"
          />
        </Pressable>

        {isOpen && (
          <View style={styles.dropdownMenu}>
            <ScrollView style={styles.dropdownScroll} bounces={false}>
              {/* Off option */}
              <TrackItem
                track={offTrack}
                isSelected={!selectedTrackId}
                onSelect={() => handleTrackSelect(null)}
                compact={compact}
              />

              {/* Divider */}
              <View style={styles.divider} />

              {/* Track list */}
              {tracks.map((track: SubtitleTrack) => (
                <TrackItem
                  key={track.id}
                  track={track}
                  isSelected={track.id === selectedTrackId}
                  onSelect={() => handleTrackSelect(track.id)}
                  compact={compact}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  // Inline mode - shows all tracks in a list
  return (
    <View style={[styles.inlineContainer, compact && styles.inlineContainerCompact]}>
      <Text style={[styles.inlineTitle, compact && styles.inlineTitleCompact]}>
        Subtitles
      </Text>

      {/* Off option */}
      <TrackItem
        track={offTrack}
        isSelected={!selectedTrackId}
        onSelect={() => handleTrackSelect(null)}
        compact={compact}
      />

      {/* Grouped by language */}
      {Array.from(groupedTracks.entries()).map(([lang, langTracks]) => (
        <View key={lang}>
          {langTracks.length > 1 && (
            <Text style={styles.languageHeader}>{lang}</Text>
          )}
          {langTracks.map((track) => (
            <TrackItem
              key={track.id}
              track={track}
              isSelected={track.id === selectedTrackId}
              onSelect={() => handleTrackSelect(track.id)}
              compact={compact}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  containerCompact: {
    padding: 8,
    gap: 6,
  },
  noSubsText: {
    color: '#52525b',
    fontSize: 14,
  },
  noSubsTextCompact: {
    fontSize: 12,
  },

  // Dropdown styles
  dropdownContainer: {
    position: 'relative',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#27272a',
    borderRadius: 8,
    minWidth: 160,
  },
  dropdownButtonCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 120,
    gap: 6,
  },
  dropdownLabel: {
    flex: 1,
    color: '#a1a1aa',
    fontSize: 14,
  },
  dropdownLabelCompact: {
    fontSize: 12,
  },
  dropdownLabelActive: {
    color: '#ffffff',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#18181b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
    overflow: 'hidden',
    zIndex: 100,
    // @ts-ignore - Web shadow
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
  },
  dropdownScroll: {
    maxHeight: 300,
  },
  divider: {
    height: 1,
    backgroundColor: '#3f3f46',
    marginVertical: 4,
  },

  // Inline styles
  inlineContainer: {
    padding: 16,
  },
  inlineContainerCompact: {
    padding: 12,
  },
  inlineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  inlineTitleCompact: {
    fontSize: 14,
    marginBottom: 8,
  },
  languageHeader: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
    marginLeft: 8,
  },

  // Track item styles
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  trackItemSelected: {
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
  },
  trackItemCompact: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  trackIcon: {
    width: 20,
  },
  trackLabel: {
    color: '#e4e4e7',
    fontSize: 14,
    flex: 1,
  },
  trackLabelSelected: {
    color: '#818cf8',
    fontWeight: '500',
  },
  trackLabelCompact: {
    fontSize: 12,
  },
  trackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackFormat: {
    fontSize: 10,
    fontWeight: '600',
    color: '#71717a',
    backgroundColor: '#27272a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  trackFormatCompact: {
    fontSize: 9,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
});

export default SubtitleSelector;
