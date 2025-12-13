/**
 * Settings Page
 *
 * User and app settings with tabbed navigation for admin features.
 *
 * UX Notes:
 * - Tab state is persisted in the URL so refreshing keeps you on the same tab
 * - All settings auto-save (no save buttons)
 * - Settings are not collapsed - everything visible by default
 */

import { useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../src/components/layout';
import { useAuth } from '../src/hooks/useAuth';
import { usePreferencesStore } from '../src/stores/preferences';
import { IntegrationsTab, LanguagePreferences } from '../src/components/settings';

type SettingsTab = 'general' | 'playback' | 'integrations';

const DEFAULT_TAB: SettingsTab = 'general';

export default function SettingsPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user, isAdmin, logout } = useAuth();
  const {
    showRatings,
    setShowRatings,
    showProgress,
    setShowProgress,
    reduceMotion,
    setReduceMotion,
  } = usePreferencesStore();

  // Get active tab from URL, default to 'general'
  const activeTab = (params.tab as SettingsTab) || DEFAULT_TAB;

  const tabs: { id: SettingsTab; label: string; icon: keyof typeof Ionicons.glyphMap; adminOnly?: boolean }[] = [
    { id: 'general', label: 'General', icon: 'person-outline' },
    { id: 'playback', label: 'Playback', icon: 'play-circle-outline' },
    { id: 'integrations', label: 'Integrations', icon: 'extension-puzzle-outline', adminOnly: true },
  ];

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  // Validate tab on mount - redirect to default if invalid
  useEffect(() => {
    const validTabIds = visibleTabs.map((t) => t.id);
    if (params.tab && !validTabIds.includes(params.tab as SettingsTab)) {
      router.replace(`/settings?tab=${DEFAULT_TAB}`);
    }
  }, [params.tab, visibleTabs, router]);

  // Handle tab change - update URL
  const handleTabChange = useCallback(
    (tabId: SettingsTab) => {
      // Use replace to avoid building up history for tab changes
      router.replace(`/settings?tab=${tabId}`);
    },
    [router]
  );

  return (
    <Layout>
      <ScrollView style={{ flex: 1, backgroundColor: '#18181b' }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }}>
          <Text style={{ fontSize: 32, fontWeight: '700', color: '#ffffff' }}>
            Settings
          </Text>
        </View>

        {/* Tabs */}
        {visibleTabs.length > 1 && (
          <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#09090b',
                borderRadius: 12,
                padding: 4,
              }}
            >
              {visibleTabs.map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => handleTabChange(tab.id)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor:
                      activeTab === tab.id ? '#27272a' : 'transparent',
                    minHeight: 48, // Touch-friendly
                  }}
                >
                  <Ionicons
                    name={tab.icon}
                    size={18}
                    color={activeTab === tab.id ? '#ffffff' : '#71717a'}
                  />
                  <Text
                    style={{
                      fontWeight: '500',
                      fontSize: 15,
                      color: activeTab === tab.id ? '#ffffff' : '#71717a',
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Content */}
        {activeTab === 'general' && (
          <View style={{ paddingHorizontal: 24, paddingBottom: 48, gap: 24 }}>
            {/* Profile Section */}
            <View style={sectionStyle}>
              <Text style={sectionTitleStyle}>Profile</Text>
              <View style={{ gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: '#3f3f46',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 24, color: '#d4d4d8', fontWeight: '600' }}>
                      {user?.displayName?.[0]?.toUpperCase() ||
                        user?.email?.[0]?.toUpperCase() ||
                        '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 18 }}>
                      {user?.displayName || user?.email?.split('@')[0]}
                    </Text>
                    <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{user?.email}</Text>
                    {isAdmin && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="shield-checkmark" size={14} color="#818cf8" />
                        <Text style={{ color: '#818cf8', fontSize: 13 }}>Administrator</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Display Preferences */}
            <View style={sectionStyle}>
              <Text style={sectionTitleStyle}>Display</Text>
              <View style={{ gap: 4 }}>
                <SettingToggle
                  label="Show Ratings"
                  description="Display rating badges on media cards"
                  value={showRatings}
                  onChange={setShowRatings}
                />
                <SettingToggle
                  label="Show Progress"
                  description="Display watch progress bars on cards"
                  value={showProgress}
                  onChange={setShowProgress}
                />
              </View>
            </View>

            {/* Accessibility */}
            <View style={sectionStyle}>
              <Text style={sectionTitleStyle}>Accessibility</Text>
              <View style={{ gap: 4 }}>
                <SettingToggle
                  label="Reduce Motion"
                  description="Minimize animations throughout the app"
                  value={reduceMotion}
                  onChange={setReduceMotion}
                />
              </View>
            </View>

            {/* Account Actions */}
            <View style={sectionStyle}>
              <Text style={sectionTitleStyle}>Account</Text>
              <Pressable
                onPress={logout}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 12,
                  minHeight: 56,
                }}
              >
                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 16 }}>
                  Sign Out
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {activeTab === 'playback' && (
          <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
            <LanguagePreferences />
          </View>
        )}

        {activeTab === 'integrations' && isAdmin && (
          <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
            <IntegrationsTab />
          </View>
        )}
      </ScrollView>
    </Layout>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function SettingToggle({
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
    <Pressable
      onPress={() => onChange(!value)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        minHeight: 72, // Large touch target
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
      }}
    >
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500', marginBottom: 4 }}>
          {label}
        </Text>
        <Text style={{ color: '#71717a', fontSize: 14 }}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#3f3f46', true: '#818cf8' }}
        thumbColor="#ffffff"
      />
    </Pressable>
  );
}

// =============================================================================
// Styles
// =============================================================================

const sectionStyle = {
  backgroundColor: '#09090b',
  borderRadius: 16,
  padding: 20,
  borderWidth: 1,
  borderColor: '#27272a',
};

const sectionTitleStyle = {
  fontSize: 18,
  fontWeight: '600' as const,
  color: '#ffffff',
  marginBottom: 16,
};
