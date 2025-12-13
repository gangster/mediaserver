/**
 * App Layout Component
 *
 * Responsive layout that adapts to different device sizes:
 * - Mobile (< 1024px): Bottom tab bar + top bar
 * - Desktop (>= 1024px): Collapsible sidebar
 */

import { View, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { Sidebar } from '../navigation/Sidebar';
import { BottomNav } from '../navigation/BottomNav';
import { MobileTopBar } from '../navigation/MobileTopBar';
import { GlobalSearch } from '../search/GlobalSearch';
import { useGlobalSearch } from '../../hooks';
import { usePreferencesStore } from '../../stores/preferences';

export interface LayoutProps {
  /** Child content to render in the main area */
  children: React.ReactNode;
}

/** Desktop breakpoint (lg) */
const DESKTOP_BREAKPOINT = 1024;

/**
 * Main Layout Component
 */
export function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const { width, height: windowHeight } = useWindowDimensions();
  const sidebarCollapsed = usePreferencesStore((state) => state.sidebarCollapsed);
  const { isOpen: searchOpen, open: openSearch, close: closeSearch } = useGlobalSearch();

  // Responsive breakpoint
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  // Check if current page is a watch page (fullscreen video)
  const isWatchPage = pathname.startsWith('/watch/');

  // Don't show navigation on watch pages
  if (isWatchPage) {
    return (
      <View className="min-h-screen bg-zinc-900">
        {children}
      </View>
    );
  }

  // Calculate sidebar width
  const sidebarWidth = sidebarCollapsed ? 64 : 256;

  return (
    <View style={{ height: windowHeight, overflow: 'hidden' }} className="bg-zinc-900">
      {/* Desktop Sidebar - hidden on mobile */}
      {isDesktop && <Sidebar onSearch={openSearch} />}

      {/* Mobile Top Bar - hidden on desktop */}
      {!isDesktop && <MobileTopBar onSearch={openSearch} />}

      {/* Main content area */}
      <View
        style={{
          flex: 1,
          height: '100%',
          paddingBottom: isDesktop ? 0 : 80,
          marginLeft: isDesktop ? sidebarWidth : 0,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>

      {/* Mobile Bottom Navigation - hidden on desktop */}
      {!isDesktop && <BottomNav />}

      {/* Global Search Modal */}
      <GlobalSearch isOpen={searchOpen} onClose={closeSearch} />
    </View>
  );
}

export default Layout;

