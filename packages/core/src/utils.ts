/**
 * Core utility functions.
 */

import { nanoid } from 'nanoid';

/**
 * Generates a unique identifier.
 * @param size - Optional size of the ID (default: 21)
 */
export function generateId(size = 21): string {
  return nanoid(size);
}

/**
 * Sleeps for the specified duration.
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clamps a number between min and max values.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Formats duration in seconds to human readable string.
 * @param seconds - Duration in seconds
 * @param format - 'short' (1h 30m) or 'long' (1 hour 30 minutes)
 */
export function formatDuration(seconds: number, format: 'short' | 'long' = 'short'): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (format === 'long') {
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    return parts.join(' ') || '0 minutes';
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Formats file size to human readable string.
 * @param bytes - Size in bytes
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Formats bitrate to human readable string.
 * @param bitsPerSecond - Bitrate in bits per second
 */
export function formatBitrate(bitsPerSecond: number): string {
  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
  }
  return `${(bitsPerSecond / 1_000).toFixed(0)} Kbps`;
}

/**
 * Truncates a string to max length with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Debounces a function.
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttles a function.
 * @param fn - Function to throttle
 * @param delay - Minimum delay between calls in milliseconds
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * Groups an array by a key function.
 */
export function groupBy<T, K extends string | number | symbol>(
  items: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

/**
 * Removes duplicates from an array based on a key function.
 */
export function uniqueBy<T>(items: T[], keyFn: (item: T) => unknown): T[] {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Sorts an array while preserving the original.
 */
export function sortBy<T>(
  items: T[],
  keyFn: (item: T) => string | number,
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  const sorted = [...items].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });

  return direction === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Creates a sort title from a regular title.
 * Removes leading articles (The, A, An) for sorting.
 */
export function createSortTitle(title: string): string {
  const articles = ['the ', 'a ', 'an '];
  const lower = title.toLowerCase();

  for (const article of articles) {
    if (lower.startsWith(article)) {
      return title.slice(article.length);
    }
  }

  return title;
}

/**
 * Checks if a value is defined (not null or undefined).
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Asserts that a condition is true, throws if false.
 */
export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Assertion failed');
  }
}

/**
 * Asserts that a value is defined.
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message ?? 'Expected value to be defined');
  }
}

/**
 * Safe JSON parse with fallback.
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Picks specified keys from an object.
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omits specified keys from an object.
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

