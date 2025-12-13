/**
 * Focus Management Hook
 *
 * Provides focus management utilities for keyboard and TV navigation.
 * Essential for accessibility and TV app development.
 *
 * @example
 * function MyComponent() {
 *   const { ref, isFocused, focus } = useFocusable({
 *     onFocus: () => console.log('focused'),
 *   });
 *
 *   return (
 *     <Pressable ref={ref}>
 *       {isFocused && <FocusRing />}
 *       <Text>Content</Text>
 *     </Pressable>
 *   );
 * }
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { findNodeHandle, AccessibilityInfo, type View } from 'react-native';
import { isTV } from '../utils/platform.js';

export interface UseFocusableOptions {
  /** Auto-focus on mount (TV only) */
  autoFocus?: boolean;
  /** Callback when focus state changes */
  onFocusChange?: (focused: boolean) => void;
  /** Callback when focused */
  onFocus?: () => void;
  /** Callback when blurred */
  onBlur?: () => void;
  /** Delay before auto-focus (ms) */
  autoFocusDelay?: number;
}

export interface UseFocusableReturn {
  /** Ref to attach to the focusable element */
  ref: React.RefObject<View>;
  /** Whether the element is currently focused */
  isFocused: boolean;
  /** Programmatically focus the element */
  focus: () => void;
  /** Programmatically blur the element */
  blur: () => void;
  /** Props to spread onto a Pressable */
  focusableProps: {
    onFocus: () => void;
    onBlur: () => void;
  };
}

/**
 * Hook for managing focus state and programmatic focus.
 */
export function useFocusable(options: UseFocusableOptions = {}): UseFocusableReturn {
  const {
    autoFocus = false,
    onFocusChange,
    onFocus,
    onBlur,
    autoFocusDelay = 100,
  } = options;

  const ref = useRef<View>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Programmatic focus
  const focus = useCallback(() => {
    if (ref.current) {
      const node = findNodeHandle(ref.current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }
  }, []);

  // Programmatic blur (not really possible in RN, but we can update state)
  const blur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
    onFocusChange?.(false);
  }, [onBlur, onFocusChange]);

  // Handle focus event
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
    onFocusChange?.(true);
  }, [onFocus, onFocusChange]);

  // Handle blur event
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
    onFocusChange?.(false);
  }, [onBlur, onFocusChange]);

  // Auto-focus on mount (TV only)
  useEffect(() => {
    if (isTV() && autoFocus) {
      const timer = setTimeout(focus, autoFocusDelay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoFocus, autoFocusDelay, focus]);

  return {
    ref,
    isFocused,
    focus,
    blur,
    focusableProps: {
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
  };
}

/**
 * Hook for managing focus within a list/grid.
 * Tracks which index is focused and provides navigation helpers.
 */
export interface UseFocusListOptions {
  /** Total number of items */
  itemCount: number;
  /** Number of columns (for grid navigation) */
  columns?: number;
  /** Initial focused index */
  initialIndex?: number;
  /** Wrap around at edges */
  wrap?: boolean;
  /** Callback when focused index changes */
  onIndexChange?: (index: number) => void;
}

export interface UseFocusListReturn {
  /** Currently focused index */
  focusedIndex: number;
  /** Set focused index */
  setFocusedIndex: (index: number) => void;
  /** Move focus to next item */
  focusNext: () => void;
  /** Move focus to previous item */
  focusPrevious: () => void;
  /** Move focus up (for grids) */
  focusUp: () => void;
  /** Move focus down (for grids) */
  focusDown: () => void;
  /** Check if an index is focused */
  isIndexFocused: (index: number) => boolean;
}

export function useFocusList(options: UseFocusListOptions): UseFocusListReturn {
  const {
    itemCount,
    columns = 1,
    initialIndex = 0,
    wrap = false,
    onIndexChange,
  } = options;

  const [focusedIndex, setFocusedIndexState] = useState(initialIndex);

  const setFocusedIndex = useCallback(
    (index: number) => {
      const clampedIndex = Math.max(0, Math.min(index, itemCount - 1));
      setFocusedIndexState(clampedIndex);
      onIndexChange?.(clampedIndex);
    },
    [itemCount, onIndexChange]
  );

  const focusNext = useCallback(() => {
    setFocusedIndex(
      wrap
        ? (focusedIndex + 1) % itemCount
        : Math.min(focusedIndex + 1, itemCount - 1)
    );
  }, [focusedIndex, itemCount, wrap, setFocusedIndex]);

  const focusPrevious = useCallback(() => {
    setFocusedIndex(
      wrap
        ? (focusedIndex - 1 + itemCount) % itemCount
        : Math.max(focusedIndex - 1, 0)
    );
  }, [focusedIndex, itemCount, wrap, setFocusedIndex]);

  const focusUp = useCallback((): void => {
    const newIndex = focusedIndex - columns;
    if (newIndex >= 0) {
      setFocusedIndex(newIndex);
    } else if (wrap) {
      // Wrap to bottom row
      const lastRowStart = Math.floor((itemCount - 1) / columns) * columns;
      const targetIndex = lastRowStart + (focusedIndex % columns);
      setFocusedIndex(Math.min(targetIndex, itemCount - 1));
    }
  }, [focusedIndex, columns, itemCount, wrap, setFocusedIndex]);

  const focusDown = useCallback((): void => {
    const newIndex = focusedIndex + columns;
    if (newIndex < itemCount) {
      setFocusedIndex(newIndex);
    } else if (wrap) {
      // Wrap to top row
      setFocusedIndex(focusedIndex % columns);
    }
  }, [focusedIndex, columns, itemCount, wrap, setFocusedIndex]);

  const isIndexFocused = useCallback(
    (index: number) => index === focusedIndex,
    [focusedIndex]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    focusNext,
    focusPrevious,
    focusUp,
    focusDown,
    isIndexFocused,
  };
}

export default useFocusable;

