/**
 * useModalKeyboard - Hook for handling keyboard events in modals
 * 
 * Handles Escape key to close modals and other keyboard shortcuts.
 */

import { useEffect, useCallback } from 'react';

export interface UseModalKeyboardOptions {
  /** Called when Escape key is pressed */
  onEscape?: () => void;
  /** Called when Enter key is pressed */
  onEnter?: () => void;
  /** Whether the modal is currently open */
  isOpen?: boolean;
}

/**
 * Hook to handle keyboard events for modals
 * 
 * @example
 * ```tsx
 * function MyModal({ isOpen, onClose }) {
 *   useModalKeyboard({ onEscape: onClose, isOpen });
 *   // ...
 * }
 * ```
 */
export function useModalKeyboard(options: UseModalKeyboardOptions): void {
  const { onEscape, onEnter, isOpen = true } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          if (onEscape) {
            e.preventDefault();
            e.stopPropagation();
            onEscape();
          }
          break;
        case 'Enter':
          // Only trigger if not in an input/textarea
          if (onEnter && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
            e.preventDefault();
            onEnter();
          }
          break;
      }
    },
    [isOpen, onEscape, onEnter]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useModalKeyboard;
