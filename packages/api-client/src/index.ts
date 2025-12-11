/**
 * @mediaserver/api-client
 *
 * tRPC client and React Query hooks for the mediaserver API.
 */

// Client
export {
  trpc,
  createApiClient,
  createQueryClient,
  defaultQueryClientConfig,
} from './client.js';
export type { ApiClientConfig, AppRouter } from './client.js';

// Provider
export { ApiProvider } from './provider.js';
export type { ApiProviderProps } from './provider.js';

// Hooks
export * from './hooks/index.js';

// Re-export useful utilities
export { QueryClientProvider, useQueryClient } from '@tanstack/react-query';

