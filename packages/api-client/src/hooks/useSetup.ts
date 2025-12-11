/**
 * Setup wizard hooks.
 *
 * Provides hooks for the setup wizard flow.
 */

import { trpc } from '../client.js';

/**
 * Hook to get setup status.
 */
export function useSetupStatus() {
  return trpc.setup.status.useQuery(undefined, {
    staleTime: 0, // Always fetch fresh
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to create owner account.
 */
export function useCreateOwner() {
  const utils = trpc.useUtils();

  return trpc.setup.createOwner.useMutation({
    onSuccess: () => {
      utils.setup.status.invalidate();
    },
  });
}

/**
 * Hook to add library during setup.
 */
export function useSetupAddLibrary() {
  const utils = trpc.useUtils();

  return trpc.setup.addLibrary.useMutation({
    onSuccess: () => {
      utils.setup.status.invalidate();
      utils.libraries.list.invalidate();
    },
  });
}

/**
 * Hook to get available metadata providers.
 */
export function useMetadataProviders() {
  return trpc.setup.getMetadataProviders.useQuery();
}

/**
 * Hook to save metadata provider configuration.
 */
export function useSaveMetadataProviders() {
  const utils = trpc.useUtils();

  return trpc.setup.saveMetadataProviders.useMutation({
    onSuccess: () => {
      utils.setup.status.invalidate();
      utils.setup.getMetadataProviders.invalidate();
    },
  });
}

/**
 * Hook to save privacy settings.
 */
export function useSavePrivacySettings() {
  return trpc.setup.savePrivacySettings.useMutation();
}

/**
 * Hook to complete setup.
 */
export function useCompleteSetup() {
  const utils = trpc.useUtils();

  return trpc.setup.complete.useMutation({
    onSuccess: () => {
      utils.setup.status.invalidate();
    },
  });
}

