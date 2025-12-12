/**
 * Collapsible Sidebar Component
 *
 * Desktop navigation sidebar with collapsed (64px) and expanded (256px) modes.
 * Hidden on mobile, visible on lg: and up.
 */

import { View, Text, Pressable } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { usePreferencesStore } from '../../stores/preferences';

/** Navigation item definition */
export interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

/** Default navigation items */
export const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Home',
    icon: (
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    path: '/movies',
    label: 'Movies',
    icon: (
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
        />
      </svg>
    ),
  },
  {
    path: '/tv',
    label: 'TV Shows',
    icon: (
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: (
      <svg
        className="w-5 h-5 flex-shrink-0"
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
    path: '/libraries',
    label: 'Libraries',
    icon: (
      <svg
        className="w-5 h-5 flex-shrink-0"
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
    adminOnly: true,
  },
];

export interface SidebarProps {
  /** Callback when search button is clicked */
  onSearch?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Navigation item with tooltip support when collapsed
 */
function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  return (
    <Link href={item.path as '/'} asChild>
      <Pressable
        className={`group relative flex flex-row items-center gap-3 px-4 py-3 rounded-lg ${
          isActive
            ? 'bg-indigo-600'
            : 'hover:bg-zinc-800 active:bg-zinc-700'
        } ${collapsed ? 'justify-center' : ''}`}
      >
        <View className={isActive ? 'text-white' : 'text-zinc-400'}>
          {item.icon}
        </View>
        {!collapsed && (
          <Text
            className={`${isActive ? 'text-white' : 'text-zinc-400'}`}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        )}
      </Pressable>
    </Link>
  );
}

/**
 * Collapse toggle button
 */
function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      className="flex flex-row items-center justify-center w-full py-3 hover:bg-zinc-800 active:bg-zinc-700"
    >
      <svg
        className={`w-5 h-5 text-zinc-400 transition-transform ${
          collapsed ? 'rotate-180' : ''
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
        />
      </svg>
    </Pressable>
  );
}

/**
 * Collapsible Sidebar Component
 */
export function Sidebar({ onSearch, className = '' }: SidebarProps) {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const { sidebarCollapsed, toggleSidebar } = usePreferencesStore();

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  // Check if a nav item is active
  const isItemActive = (item: NavItem) => {
    if (item.path === '/') {
      return pathname === '/';
    }
    return pathname === item.path || pathname.startsWith(`${item.path}/`);
  };

  return (
    <View
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: sidebarCollapsed ? 64 : 256,
        backgroundColor: 'rgba(24, 24, 27, 0.5)',
        borderRightWidth: 1,
        borderRightColor: '#27272a',
        zIndex: 40,
      }}
      className={`flex flex-col ${className}`}
    >
      {/* Logo */}
      <View className={`${sidebarCollapsed ? 'p-3' : 'p-6'}`}>
        <Link href="/" asChild>
          <Pressable
            className={`flex flex-row items-center ${
              sidebarCollapsed ? 'justify-center' : 'gap-3'
            }`}
          >
            <View className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Text className="text-white font-bold text-lg">M</Text>
            </View>
            {!sidebarCollapsed && (
              <Text className="text-xl font-bold text-white">Mediaserver</Text>
            )}
          </Pressable>
        </Link>
      </View>

      {/* Search button */}
      {onSearch && (
        <View className={`${sidebarCollapsed ? 'px-2' : 'px-4'} mb-2`}>
          <Pressable
            onPress={onSearch}
            className={`group relative w-full flex flex-row items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <svg
              className="w-5 h-5 flex-shrink-0 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {!sidebarCollapsed && (
              <>
                <Text className="flex-1 text-left text-zinc-400">Search</Text>
                <View className="hidden lg:flex flex-row items-center gap-0.5 px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">
                  <Text className="text-xs text-zinc-500">⌘K</Text>
                </View>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Navigation */}
      <View className={`flex-1 gap-1 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            item={item}
            isActive={isItemActive(item)}
            collapsed={sidebarCollapsed}
          />
        ))}
      </View>

      {/* User section */}
      <View className="border-t border-zinc-800">
        {/* User info */}
        <View
          className={`flex flex-row items-center ${
            sidebarCollapsed ? 'justify-center p-3' : 'gap-3 p-4'
          }`}
        >
          <View className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
            <Text className="text-zinc-300 font-medium">
              {user?.displayName?.[0]?.toUpperCase() ||
                user?.email?.[0]?.toUpperCase() ||
                '?'}
            </Text>
          </View>
          {!sidebarCollapsed && (
            <View className="flex-1 min-w-0">
              <Text className="text-white text-sm font-medium" numberOfLines={1}>
                {user?.displayName || user?.email?.split('@')[0]}
              </Text>
              <Text className="text-zinc-500 text-xs" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          )}
        </View>

        {/* Logout button */}
        <Pressable
          onPress={logout}
          className={`w-full flex flex-row items-center gap-3 py-3 hover:bg-zinc-800 active:bg-zinc-700 ${
            sidebarCollapsed ? 'justify-center px-3' : 'px-4'
          }`}
        >
          <svg
            className="w-5 h-5 flex-shrink-0 text-zinc-400"
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
          {!sidebarCollapsed && (
            <Text className="text-sm text-zinc-400">Sign out</Text>
          )}
        </Pressable>

        {/* Collapse toggle */}
        <CollapseToggle collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </View>
    </View>
  );
}

export default Sidebar;
