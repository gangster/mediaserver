/**
 * Library-related hooks.
 */

import { trpc } from '../client.js';

/**
 * Hook for checking if a path exists.
 * Used by setup wizard for path validation.
 */
export function useCheckPath(path: string, enabled = true) {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.checkPath.useQuery({ path }, { enabled: enabled && !!path });
}

/**
 * Hook for creating a directory.
 * Used by setup wizard to create library folders.
 */
export function useCreatePath() {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.createPath.useMutation();
}

/**
 * Get trpc utilities for imperative calls.
 */
export function useLibraryUtils() {
  return trpc.useUtils();
}

/**
 * Hook for fetching all libraries.
 */
export function useLibraries() {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.list.useQuery();
}

/**
 * Hook for fetching a single library by ID.
 */
export function useLibrary(id: string, enabled = true) {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.get.useQuery({ id }, { enabled });
}

/**
 * Hook for fetching library statistics.
 */
export function useLibraryStats(id: string, enabled = true) {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.stats.useQuery({ id }, { enabled });
}

/**
 * Hook for creating a library.
 */
export function useCreateLibrary() {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.create.useMutation();
}

/**
 * Hook for updating a library.
 */
export function useUpdateLibrary() {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.update.useMutation();
}

/**
 * Hook for deleting a library.
 */
export function useDeleteLibrary() {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.delete.useMutation();
}

/**
 * Hook for triggering a library scan.
 */
export function useScanLibrary() {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.scan.useMutation();
}

/**
 * Hook for getting library scan status.
 */
export function useLibraryScanStatus(id: string, enabled = true) {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.scanStatus.useQuery({ id }, { enabled, refetchInterval: 2000 });
}

/**
 * Hook for granting library permission.
 */
export function useGrantLibraryPermission() {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.grantPermission.useMutation();
}

/**
 * Hook for revoking library permission.
 */
export function useRevokeLibraryPermission() {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.revokePermission.useMutation();
}

/**
 * Hook for listing library permissions.
 */
export function useLibraryPermissions(libraryId: string, enabled = true) {
  // @ts-expect-error - Router not yet defined
  return trpc.libraries.listPermissions.useQuery({ libraryId }, { enabled });
}

