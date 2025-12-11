/**
 * Settings screen.
 */

import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BRANDING } from '@mediaserver/core';
import { useAuthStore } from '../../src/stores/auth';

// Settings section component
function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-zinc-400 text-sm font-medium mb-2 px-4 uppercase tracking-wide">
        {title}
      </Text>
      <View className="bg-zinc-900 rounded-xl overflow-hidden mx-4">
        {children}
      </View>
    </View>
  );
}

// Settings item component
function SettingsItem({
  label,
  value,
  onPress,
  danger = false,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      className="flex-row items-center justify-between px-4 py-4 border-b border-zinc-800 last:border-b-0 active:bg-zinc-800"
      onPress={onPress}
      disabled={!onPress}
    >
      <Text className={danger ? 'text-error' : 'text-white'}>{label}</Text>
      {value && <Text className="text-zinc-500">{value}</Text>}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await clearAuth();
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1">
        <View className="pt-4 pb-2 px-4">
          <Text className="text-2xl font-bold text-white">Settings</Text>
        </View>

        {/* Account */}
        <SettingsSection title="Account">
          <SettingsItem label="Name" value={user?.displayName} />
          <SettingsItem label="Email" value={user?.email} />
          <SettingsItem label="Role" value={user?.role} />
        </SettingsSection>

        {/* Preferences */}
        <SettingsSection title="Preferences">
          <SettingsItem label="Language" value="English" onPress={() => {}} />
          <SettingsItem label="Audio Language" value="English" onPress={() => {}} />
          <SettingsItem label="Subtitle Language" value="None" onPress={() => {}} />
          <SettingsItem label="Default Quality" value="Auto" onPress={() => {}} />
        </SettingsSection>

        {/* Admin (if applicable) */}
        {(user?.role === 'owner' || user?.role === 'admin') && (
          <SettingsSection title="Administration">
            <SettingsItem label="Libraries" onPress={() => {}} />
            <SettingsItem label="Users" onPress={() => {}} />
            <SettingsItem label="Privacy" onPress={() => {}} />
            <SettingsItem label="Remote Access" onPress={() => {}} />
          </SettingsSection>
        )}

        {/* About */}
        <SettingsSection title="About">
          <SettingsItem label="Version" value="0.1.0" />
          <SettingsItem label="Server" value="Connected" />
        </SettingsSection>

        {/* Logout */}
        <SettingsSection title="">
          <SettingsItem label="Sign Out" onPress={handleLogout} danger />
        </SettingsSection>

        {/* Footer */}
        <View className="items-center py-8">
          <Text className="text-zinc-600 text-sm">{BRANDING.name}</Text>
          <Text className="text-zinc-700 text-xs">{BRANDING.tagline}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

