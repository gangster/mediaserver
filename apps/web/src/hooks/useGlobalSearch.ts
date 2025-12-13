/**
 * Global Search hook
 *
 * Manages global search modal state and keyboard shortcuts.
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

/** Global search state and actions */
interface UseGlobalSearchReturn {
  /** Whether the search modal is open */
  isOpen: boolean;
  /** Open the search modal */
  open: () => void;
  /** Close the search modal */
  close: () => void;
  /** Toggle the search modal */
  toggle: () => void;
}

/**
 * Hook to manage global search modal state
 *
 * Registers Cmd+K / Ctrl+K keyboard shortcut on web.
 *
 * @returns Search modal state and actions
 *
 * @example
 * const { isOpen, open, close } = useGlobalSearch();
 *
 * return (
 *   <>
 *     <Button onPress={open}>Search</Button>
 *     {isOpen && <GlobalSearchModal onClose={close} />}
 *   </>
 * );
 */
export function useGlobalSearch(): UseGlobalSearchReturn {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Register Cmd+K / Ctrl+K keyboard shortcut on web
  // Note: Escape is handled by the GlobalSearch component's onKeyPress
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux) to toggle
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, open, close, toggle };
}

