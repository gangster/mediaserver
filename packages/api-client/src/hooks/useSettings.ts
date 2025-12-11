/**
 * Settings-related hooks.
 */

import { trpc } from '../client.js';

/**
 * Hook for getting privacy settings.
 */
export function usePrivacySettings() {
  // @ts-expect-error - Router not yet defined
  return trpc.settings.getPrivacy.useQuery();
}

/**
 * Hook for updating privacy settings.
 */
export function useUpdatePrivacySettings() {
  // @ts-expect-error - Router not yet defined
  return trpc.settings.updatePrivacy.useMutation();
}

/**
 * Hook for getting license info.
 */
export function useLicense() {
  // @ts-expect-error - Router not yet defined
  return trpc.settings.getLicense.useQuery();
}

/**
 * Hook for activating a license.
 */
export function useActivateLicense() {
  // @ts-expect-error - Router not yet defined
  return trpc.settings.activateLicense.useMutation();
}

/**
 * Hook for getting remote access config.
 */
export function useRemoteAccessConfig() {
  // @ts-expect-error - Router not yet defined
  return trpc.settings.getRemoteAccess.useQuery();
}

/**
 * Hook for updating remote access config.
 */
export function useUpdateRemoteAccessConfig() {
  // @ts-expect-error - Router not yet defined
  return trpc.settings.updateRemoteAccess.useMutation();
}

/**
 * Hook for getting provider configurations.
 */
export function useProviderConfigs() {
  // @ts-expect-error - Router not yet defined
  return trpc.settings.getProviders.useQuery();
}

/**
 * Hook for updating a provider configuration.
 */
export function useUpdateProviderConfig() {
  // @ts-expect-error - Router not yet defined
  return trpc.settings.updateProvider.useMutation();
}

/**
 * Hook for getting server statistics.
 */
export function useServerStats() {
  // @ts-expect-error - Router not yet defined
  return trpc.settings.stats.useQuery();
}

