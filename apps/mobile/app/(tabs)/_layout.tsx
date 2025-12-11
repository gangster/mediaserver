/**
 * Tab navigation layout.
 */

import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

// Placeholder icons - in a real app, use Lucide or similar
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: '🏠',
    movies: '🎬',
    tv: '📺',
    search: '🔍',
    settings: '⚙️',
  };

  return (
    <View className="items-center">
      <Text className="text-2xl">{icons[name] ?? '•'}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#18181b',
          borderTopColor: '#27272a',
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#71717a',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="movies"
        options={{
          title: 'Movies',
          tabBarIcon: ({ focused }) => <TabIcon name="movies" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tv"
        options={{
          title: 'TV Shows',
          tabBarIcon: ({ focused }) => <TabIcon name="tv" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

