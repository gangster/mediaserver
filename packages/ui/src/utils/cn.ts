/**
 * Class name utilities for NativeWind.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names with Tailwind conflict resolution.
 * Combines clsx for conditional classes and tailwind-merge for deduplication.
 *
 * @example
 * cn('text-red-500', condition && 'text-blue-500')
 * // If condition is true, returns 'text-blue-500' (blue wins)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

