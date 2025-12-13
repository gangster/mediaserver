/**
 * Settings Page
 *
 * User and app settings with tabbed navigation for admin features.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { Layout } from '../src/components/layout';
import { useAuth } from '../src/hooks/useAuth';
import { usePreferencesStore } from '../src/stores/preferences';
import { IntegrationsTab } from '../src/components/settings';
import { SubtitlePreferences } from '../src/components/settings/SubtitlePreferences';

type SettingsTab = 'general' | 'playback' | 'integrations';

export default function SettingsPage() {
  const { user, isAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const {
    showRatings,
    setShowRatings,
    showProgress,
    setShowProgress,
    reduceMotion,
    setReduceMotion,
  } = usePreferencesStore();

  const tabs: { id: SettingsTab; label: string; adminOnly?: boolean }[] = [
    { id: 'general', label: 'General' },
    { id: 'playback', label: 'Playback' },
    { id: 'integrations', label: 'Integrations', adminOnly: true },
  ];

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <Layout>
      <ScrollView className="flex-1 bg-zinc-900">
        {/* Header */}
        <View className="px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <Text className="text-2xl sm:text-3xl font-bold text-white">
            Settings
          </Text>
        </View>

        {/* Tabs */}
        {visibleTabs.length > 1 && (
          <View className="px-4 sm:px-6 lg:px-8 mb-6">
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#18181b',
                borderRadius: 8,
                padding: 4,
                gap: 4,
              }}
            >
              {visibleTabs.map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 6,
                    backgroundColor:
                      activeTab === tab.id ? '#27272a' : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      fontWeight: '500',
                      color: activeTab === tab.id ? '#fff' : '#a1a1aa',
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
          <View className="px-4 sm:px-6 lg:px-8 pb-8 gap-6">
            {/* Profile Section */}
            <View className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <Text className="text-lg font-semibold text-white mb-4">
                Profile
              </Text>
              <View className="gap-4">
                <View className="flex flex-row items-center gap-4">
                  <View className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center">
                    <Text className="text-2xl text-zinc-300 font-medium">
                      {user?.displayName?.[0]?.toUpperCase() ||
                        user?.email?.[0]?.toUpperCase() ||
                        '?'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-medium text-lg">
                      {user?.displayName || user?.email?.split('@')[0]}
                    </Text>
                    <Text className="text-zinc-400">{user?.email}</Text>
                    {isAdmin && (
                      <Text className="text-indigo-400 text-sm mt-1">
                        Administrator
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Display Preferences */}
            <View className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <Text className="text-lg font-semibold text-white mb-4">
                Display
              </Text>
              <View className="gap-4">
                <View className="flex flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-white">Show Ratings</Text>
                    <Text className="text-zinc-400 text-sm">
                      Display rating badges on media cards
                    </Text>
                  </View>
                  <Switch
                    value={showRatings}
                    onValueChange={setShowRatings}
                    trackColor={{ false: '#3f3f46', true: '#059669' }}
                    thumbColor="#ffffff"
                  />
                </View>
                <View className="flex flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-white">Show Progress</Text>
                    <Text className="text-zinc-400 text-sm">
                      Display watch progress bars on cards
                    </Text>
                  </View>
                  <Switch
                    value={showProgress}
                    onValueChange={setShowProgress}
                    trackColor={{ false: '#3f3f46', true: '#059669' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            </View>

            {/* Accessibility */}
            <View className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <Text className="text-lg font-semibold text-white mb-4">
                Accessibility
              </Text>
              <View className="gap-4">
                <View className="flex flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-white">Reduce Motion</Text>
                    <Text className="text-zinc-400 text-sm">
                      Minimize animations throughout the app
                    </Text>
                  </View>
                  <Switch
                    value={reduceMotion}
                    onValueChange={setReduceMotion}
                    trackColor={{ false: '#3f3f46', true: '#059669' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            </View>

            {/* Account Actions */}
            <View className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <Text className="text-lg font-semibold text-white mb-4">
                Account
              </Text>
              <Pressable
                onPress={logout}
                className="flex flex-row items-center gap-3 px-4 py-3 bg-red-600/10 rounded-lg active:bg-red-600/20"
              >
                <svg
                  className="w-5 h-5 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <Text className="text-red-400 font-medium">Sign Out</Text>
              </Pressable>
            </View>
          </View>
        )}

        {activeTab === 'playback' && (
          <View className="px-4 sm:px-6 lg:px-8 pb-8">
            <View className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <SubtitlePreferences />
            </View>
          </View>
        )}

        {activeTab === 'integrations' && isAdmin && (
          <View className="px-4 sm:px-6 lg:px-8 pb-8">
            <IntegrationsTab />
          </View>
        )}
      </ScrollView>
    </Layout>
  );
}

