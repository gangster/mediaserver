/**
 * Bottom Navigation Component
 *
 * Mobile tab bar with 4 tabs:
 * - Home: Dashboard with rows
 * - Library: Opens picker for Movies/TV Shows
 * - Search: Full-screen search
 * - More: Settings, Libraries, Profile
 *
 * Hidden on lg: and up (desktop shows sidebar instead).
 */

import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { LibraryPicker } from './LibraryPicker';
import { MobileMenu } from './MobileMenu';

/** Tab definition */
interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Path to navigate to (if not a special tab) */
  path?: string;
}

const tabs: Tab[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
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
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    id: 'library',
    label: 'Library',
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
          d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
        />
      </svg>
    ),
  },
  {
    id: 'search',
    label: 'Search',
    path: '/search',
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
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
  },
  {
    id: 'more',
    label: 'More',
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
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    ),
  },
];

export interface BottomNavProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Bottom Navigation Component
 */
export function BottomNav({ className = '' }: BottomNavProps) {
  const pathname = usePathname();
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Determine active tab
  const getActiveTab = () => {
    if (pathname === '/') return 'home';
    if (pathname.startsWith('/movies') || pathname.startsWith('/tv')) {
      return 'library';
    }
    if (pathname.startsWith('/search')) return 'search';
    if (
      pathname.startsWith('/libraries') ||
      pathname.startsWith('/settings')
    ) {
      return 'more';
    }
    return 'home';
  };

  const activeTab = getActiveTab();

  const handleTabPress = (tab: Tab) => {
    if (tab.id === 'library') {
      setLibraryPickerOpen(true);
    } else if (tab.id === 'more') {
      setMoreMenuOpen(true);
    }
    // For tabs with paths, Link component handles navigation
  };

  return (
    <>
      <View
        className={`lg:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 border-t border-zinc-800 z-40 ${className}`}
        // @ts-expect-error - backdropFilter is web-only
        style={{
          backdropFilter: 'blur(24px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <View className="flex flex-row items-center justify-around h-16">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isSpecialTab = tab.id === 'library' || tab.id === 'more';

            // Render as button for special tabs, Link for regular tabs
            if (isSpecialTab) {
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => handleTabPress(tab)}
                  className="flex flex-col items-center justify-center flex-1 h-full min-w-[64px]"
                >
                  <View className={isActive ? 'text-indigo-400' : 'text-zinc-400'}>
                    {tab.icon}
                  </View>
                  <Text
                    className={`text-xs mt-1 ${
                      isActive ? 'text-indigo-400' : 'text-zinc-400'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            }

            return (
              <Link key={tab.id} href={tab.path as '/'} asChild>
                <Pressable className="flex flex-col items-center justify-center flex-1 h-full min-w-[64px]">
                  <View className={isActive ? 'text-indigo-400' : 'text-zinc-400'}>
                    {tab.icon}
                  </View>
                  <Text
                    className={`text-xs mt-1 ${
                      isActive ? 'text-indigo-400' : 'text-zinc-400'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </View>

      {/* Library Picker Modal */}
      <LibraryPicker
        isOpen={libraryPickerOpen}
        onClose={() => setLibraryPickerOpen(false)}
      />

      {/* More Menu */}
      <MobileMenu
        isOpen={moreMenuOpen}
        onClose={() => setMoreMenuOpen(false)}
      />
    </>
  );
}

export default BottomNav;
