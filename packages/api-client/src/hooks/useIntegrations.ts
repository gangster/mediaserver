/**
 * Integration-related hooks for managing metadata integrations.
 */

import { trpc } from '../client.js';

/**
 * Hook for listing all integrations with their status.
 */
export function useIntegrations() {
  return trpc.integrations.list.useQuery();
}

/**
 * Hook for getting a single integration's config.
 * Always refetches on mount to ensure fresh data (useful for modals).
 */
export function useIntegration(id: string, enabled = true) {
  return trpc.integrations.get.useQuery(
    { id },
    {
      enabled,
      staleTime: 0, // Always consider data stale
      refetchOnMount: 'always', // Refetch every time component mounts
    }
  );
}

/**
 * Hook for updating an integration's configuration.
 */
export function useUpdateIntegration() {
  return trpc.integrations.update.useMutation();
}

/**
 * Hook for testing an integration's connection.
 */
export function useTestIntegrationConnection() {
  return trpc.integrations.testConnection.useMutation();
}

/**
 * Hook for getting rating sources configuration.
 */
export function useRatingSources() {
  return trpc.integrations.getRatingSources.useQuery();
}

/**
 * Hook for updating rating sources configuration.
 */
export function useUpdateRatingSources() {
  return trpc.integrations.setRatingSources.useMutation();
}

/**
 * Hook for getting OAuth authorization URL.
 */
export function useGetOAuthUrl() {
  return trpc.integrations.getOAuthUrl.useMutation();
}

/**
 * Hook for handling OAuth callback.
 */
export function useHandleOAuthCallback() {
  return trpc.integrations.handleOAuthCallback.useMutation();
}

/**
 * Hook for disconnecting OAuth.
 */
export function useDisconnectOAuth() {
  return trpc.integrations.disconnectOAuth.useMutation();
}

/**
 * Hook for getting OAuth connection status.
 */
export function useOAuthStatus(id: string, enabled = true) {
  return trpc.integrations.getOAuthStatus.useQuery({ id }, { enabled });
}

/**
 * Hook for getting primary metadata providers configuration.
 */
export function usePrimaryProviders() {
  return trpc.integrations.getPrimaryProviders.useQuery();
}

/**
 * Hook for updating primary metadata providers.
 */
export function useUpdatePrimaryProviders() {
  return trpc.integrations.setPrimaryProviders.useMutation();
}
