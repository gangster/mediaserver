/**
 * Auto-Save Hook
 *
 * A reusable hook for automatically saving data after changes.
 * This pattern should be used throughout the app instead of manual save buttons.
 *
 * Design principles:
 * - Debounced saves to avoid excessive API calls
 * - Visual feedback while saving
 * - Error handling with optional retry
 * - Works well with mobile/TV where explicit save buttons are awkward
 *
 * Usage:
 * ```tsx
 * const { isSaving, error } = useAutoSave(
 *   myData,
 *   async (data) => await saveMutation.mutateAsync(data),
 *   { delay: 800 }
 * );
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface AutoSaveOptions {
  /** Debounce delay in ms (default: 800) */
  delay?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Called when save succeeds */
  onSuccess?: () => void;
  /** Called when save fails */
  onError?: (error: Error) => void;
}

interface AutoSaveResult {
  /** Whether a save is currently in progress */
  isSaving: boolean;
  /** The last error that occurred, if any */
  error: Error | null;
  /** Manually trigger a save (bypasses debounce) */
  saveNow: () => Promise<void>;
  /** Clear any pending save */
  cancel: () => void;
}

/**
 * Auto-save hook with debouncing.
 *
 * @param data - The data to save (triggers save when this changes)
 * @param saveFn - Async function to save the data
 * @param options - Configuration options
 */
export function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  options: AutoSaveOptions = {}
): AutoSaveResult {
  const { delay = 800, enabled = true, onSuccess, onError } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dataRef = useRef(data);
  const isFirstRender = useRef(true);

  // Keep data ref updated
  dataRef.current = data;

  // Save function
  const performSave = useCallback(async () => {
    if (!enabled) return;

    setIsSaving(true);
    setError(null);

    try {
      await saveFn(dataRef.current);
      onSuccess?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsSaving(false);
    }
  }, [enabled, saveFn, onSuccess, onError]);

  // Cancel any pending save
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Manual save (bypasses debounce)
  const saveNow = useCallback(async () => {
    cancel();
    await performSave();
  }, [cancel, performSave]);

  // Debounced auto-save on data change
  useEffect(() => {
    // Skip first render to avoid saving initial data
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!enabled) return;

    // Clear existing timer
    cancel();

    // Set new timer
    timerRef.current = setTimeout(() => {
      performSave();
    }, delay);

    // Cleanup on unmount or re-trigger
    return cancel;
  }, [data, delay, enabled, cancel, performSave]);

  // Cleanup on unmount
  useEffect(() => {
    return cancel;
  }, [cancel]);

  return {
    isSaving,
    error,
    saveNow,
    cancel,
  };
}

/**
 * Simpler auto-save hook for single values.
 * Useful for toggles, selects, etc.
 */
export function useAutoSaveValue<T>(
  value: T,
  saveFn: (value: T) => Promise<void>,
  options: AutoSaveOptions = {}
): AutoSaveResult {
  return useAutoSave(value, saveFn, options);
}

export default useAutoSave;

