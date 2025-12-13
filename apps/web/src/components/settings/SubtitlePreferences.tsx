/**
 * Subtitle Preferences Component (Placeholder)
 *
 * This component is being replaced by the unified Language Preferences UI
 * which handles both audio and subtitle preferences together.
 *
 * TODO: Replace with LanguagePreferences component when implemented
 */

import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SubtitlePreferencesProps {
  /** Whether to show the full settings view or compact version */
  compact?: boolean;
}

export function SubtitlePreferences({ compact = false }: SubtitlePreferencesProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Text style={[styles.title, compact && styles.titleCompact]}>
        Language Preferences
      </Text>

      <View style={styles.placeholder}>
        <Ionicons name="construct-outline" size={48} color="#52525b" />
        <Text style={styles.placeholderTitle}>Coming Soon</Text>
        <Text style={styles.placeholderText}>
          We&apos;re building a unified language preference system that handles
          both audio and subtitle track selection with intelligent rules.
        </Text>
        <View style={styles.featureList}>
          <FeatureItem text="Audio language preferences with fallback chains" />
          <FeatureItem text="Subtitle mode (off, auto, always, foreign only)" />
          <FeatureItem text="Content-based rules (Anime, K-Drama, Foreign Films)" />
          <FeatureItem text="Per-show overrides and session memory" />
          <FeatureItem text="Forced subtitle support" />
          <FeatureItem text="Audio quality preferences" />
        </View>
      </View>
    </View>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <View style={styles.featureItem}>
      <Ionicons name="checkmark-circle" size={16} color="#818cf8" />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  containerCompact: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 24,
  },
  titleCompact: {
    fontSize: 18,
    marginBottom: 16,
  },
  placeholder: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 22,
    marginBottom: 24,
  },
  featureList: {
    width: '100%',
    maxWidth: 400,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#d4d4d8',
  },
});

export default SubtitlePreferences;
