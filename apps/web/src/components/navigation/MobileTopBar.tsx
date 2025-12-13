/**
 * Mobile Top Bar Component
 *
 * Context-aware header for mobile devices.
 * Shows logo on home, back button + title on detail pages.
 * Hidden on lg: and up (desktop shows sidebar instead).
 */

import { View, Text, Pressable } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

/** Page title configuration */
interface PageConfig {
  pattern: RegExp;
  title: string | ((pathname: string) => string);
  showBackButton: boolean;
}

const pageConfigs: PageConfig[] = [
  { pattern: /^\/$/, title: 'Home', showBackButton: false },
  { pattern: /^\/movies$/, title: 'Movies', showBackButton: false },
  { pattern: /^\/movies\/[^/]+$/, title: 'Movie', showBackButton: true },
  { pattern: /^\/tv$/, title: 'TV Shows', showBackButton: false },
  { pattern: /^\/tv\/[^/]+$/, title: 'Show', showBackButton: true },
  { pattern: /^\/tv\/[^/]+\/season\/\d+$/, title: 'Season', showBackButton: true },
  { pattern: /^\/watch\//, title: '', showBackButton: true },
  { pattern: /^\/search/, title: 'Search', showBackButton: false },
  { pattern: /^\/libraries$/, title: 'Libraries', showBackButton: false },
  { pattern: /^\/settings/, title: 'Settings', showBackButton: false },
];

export interface MobileTopBarProps {
  /** Additional CSS classes */
  className?: string;
  /** Custom title override */
  title?: string;
  /** Custom right-side actions */
  actions?: React.ReactNode;
  /** Callback when search button is clicked */
  onSearch?: () => void;
}

/**
 * Mobile Top Bar Component
 */
export function MobileTopBar({
  className = '',
  title: customTitle,
  actions,
  onSearch,
}: MobileTopBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Find matching page config
  const pageConfig = pageConfigs.find((config) =>
    config.pattern.test(pathname)
  );

  const showBackButton = pageConfig?.showBackButton ?? false;
  const pageTitle =
    customTitle ??
    (typeof pageConfig?.title === 'function'
      ? pageConfig.title(pathname)
      : pageConfig?.title ?? '');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  // Hide on watch pages (video player has its own controls)
  if (pathname.startsWith('/watch/')) {
    return null;
  }

  return (
    <View
      className={`lg:hidden sticky top-0 z-30 bg-zinc-900/95 border-b border-zinc-800 ${className}`}
      // @ts-expect-error - web-only styles
      style={{
        backdropFilter: 'blur(24px)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <View className="flex flex-row items-center h-14 px-4">
        {/* Left: Back button or Logo */}
        <View className="flex flex-row items-center gap-2 w-16">
          {showBackButton ? (
            <Pressable
              onPress={handleBack}
              className="p-2 -ml-2 touch-target"
            >
              <svg
                className="w-6 h-6 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Pressable>
          ) : (
            <View className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Text className="text-white font-bold text-sm">M</Text>
            </View>
          )}
        </View>

        {/* Center: Title */}
        <View className="flex-1 items-center">
          {pageTitle ? (
            <Text
              className="text-lg font-semibold text-white"
              numberOfLines={1}
            >
              {pageTitle}
            </Text>
          ) : null}
        </View>

        {/* Right: Actions */}
        <View className="flex flex-row items-center justify-end gap-2 w-16">
          {onSearch && (
            <Pressable
              onPress={onSearch}
              className="p-2 touch-target"
            >
              <svg
                className="w-5 h-5 text-zinc-400"
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
            </Pressable>
          )}
          {actions}
        </View>
      </View>
    </View>
  );
}

export default MobileTopBar;

