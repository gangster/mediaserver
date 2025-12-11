/**
 * Platform detection utilities.
 */

import { Platform } from 'react-native';

/** Platform types */
export type PlatformType = 'ios' | 'android' | 'web' | 'tv';

/**
 * Checks if running on iOS.
 */
export function isIOS(): boolean {
  return Platform.OS === 'ios';
}

/**
 * Checks if running on Android.
 */
export function isAndroid(): boolean {
  return Platform.OS === 'android';
}

/**
 * Checks if running on web.
 */
export function isWeb(): boolean {
  return Platform.OS === 'web';
}

/**
 * Checks if running on a TV platform.
 */
export function isTV(): boolean {
  return Platform.isTV;
}

/**
 * Checks if running on mobile (iOS or Android, not TV).
 */
export function isMobile(): boolean {
  return (Platform.OS === 'ios' || Platform.OS === 'android') && !Platform.isTV;
}

/**
 * Gets the current platform type.
 */
export function getPlatform(): PlatformType {
  if (Platform.isTV) return 'tv';
  if (Platform.OS === 'web') return 'web';
  if (Platform.OS === 'ios') return 'ios';
  return 'android';
}

/**
 * Returns a platform-specific value.
 *
 * @example
 * const padding = platformSelect({
 *   ios: 16,
 *   android: 12,
 *   web: 24,
 *   tv: 32,
 *   default: 16,
 * });
 */
export function platformSelect<T>(options: {
  ios?: T;
  android?: T;
  web?: T;
  tv?: T;
  default: T;
}): T {
  const platform = getPlatform();

  if (platform === 'tv' && options.tv !== undefined) {
    return options.tv;
  }
  if (platform === 'ios' && options.ios !== undefined) {
    return options.ios;
  }
  if (platform === 'android' && options.android !== undefined) {
    return options.android;
  }
  if (platform === 'web' && options.web !== undefined) {
    return options.web;
  }

  return options.default;
}

