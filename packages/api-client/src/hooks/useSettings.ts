/**
 * Settings-related hooks.
 */

import { trpc } from '../client.js';

/**
 * Hook for getting privacy settings.
 */
export function usePrivacySettings() {
  return trpc.settings.getPrivacy.useQuery();
}

/**
 * Hook for updating privacy settings.
 */
export function useUpdatePrivacySettings() {
  return trpc.settings.updatePrivacy.useMutation();
}

/**
 * Hook for getting license info.
 */
export function useLicense() {
  return trpc.settings.getLicense.useQuery();
}

/**
 * Hook for activating a license.
 */
export function useActivateLicense() {
  return trpc.settings.activateLicense.useMutation();
}

/**
 * Hook for getting remote access config.
 */
export function useRemoteAccessConfig() {
  return trpc.settings.getRemoteAccess.useQuery();
}

/**
 * Hook for updating remote access config.
 */
export function useUpdateRemoteAccessConfig() {
  return trpc.settings.updateRemoteAccess.useMutation();
}

/**
 * Hook for getting provider configurations.
 */
export function useProviderConfigs() {
  return trpc.settings.getProviders.useQuery();
}

/**
 * Hook for updating a provider configuration.
 */
export function useUpdateProviderConfig() {
  return trpc.settings.updateProvider.useMutation();
}

/**
 * Hook for getting server statistics.
 */
export function useServerStats() {
  return trpc.settings.stats.useQuery();
}

