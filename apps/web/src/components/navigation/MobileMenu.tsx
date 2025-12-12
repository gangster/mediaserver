/**
 * Mobile Menu Component
 *
 * Slide-up sheet menu for additional options (Settings, Libraries, Profile).
 * Accessible from the "More" tab in the bottom navigation.
 */

import { useEffect, useCallback } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

/** Menu item definition */
interface MenuItem {
  id: string;
  label: string;
  path?: string;
  icon: React.ReactNode;
  action?: () => void;
  adminOnly?: boolean;
  destructive?: boolean;
}

export interface MobileMenuProps {
  /** Whether the menu is open */
  isOpen: boolean;
  /** Callback when menu should close */
  onClose: () => void;
}

/**
 * Mobile Menu Component
 */
export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const menuItems: MenuItem[] = [
    {
      id: 'libraries',
      label: 'Manage Libraries',
      path: '/libraries',
      adminOnly: true,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      path: '/settings',
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      id: 'logout',
      label: 'Sign Out',
      destructive: true,
      action: () => {
        logout();
        onClose();
      },
      icon: (
        <svg
          className="w-6 h-6"
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
      ),
    },
  ];

  const visibleItems = menuItems.filter((item) => !item.adminOnly || isAdmin);

  const handleItemClick = (item: MenuItem) => {
    if (item.action) {
      item.action();
    } else if (item.path) {
      router.push(item.path as '/settings');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <View className="fixed inset-0 z-50">
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        className="absolute inset-0 bg-black/60 animate-fade-in"
      />

      {/* Sheet */}
      <View className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-2xl animate-slide-up safe-area-pb">
        {/* Handle */}
        <View className="flex items-center pt-3 pb-2">
          <View className="w-10 h-1 rounded-full bg-zinc-600" />
        </View>

        {/* User info */}
        <View className="px-6 pb-4 border-b border-zinc-800">
          <View className="flex flex-row items-center gap-3">
            <View className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
              <Text className="text-zinc-300 text-lg font-medium">
                {user?.displayName?.[0]?.toUpperCase() ||
                  user?.email?.[0]?.toUpperCase() ||
                  '?'}
              </Text>
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-white font-medium" numberOfLines={1}>
                {user?.displayName || user?.email?.split('@')[0]}
              </Text>
              <Text className="text-sm text-zinc-400" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu items */}
        <View className="py-2">
          {visibleItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleItemClick(item)}
              className={`w-full flex flex-row items-center gap-4 px-6 py-4 touch-target ${
                item.destructive
                  ? 'active:bg-red-500/20'
                  : 'active:bg-zinc-700'
              }`}
            >
              <View className={item.destructive ? 'text-red-400' : 'text-zinc-400'}>
                {item.icon}
              </View>
              <Text className={item.destructive ? 'text-red-400' : 'text-white'}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Cancel button */}
        <View className="px-4 pb-4 pt-2">
          <Pressable
            onPress={onClose}
            className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 touch-target"
          >
            <Text className="text-zinc-300 text-center">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default MobileMenu;
