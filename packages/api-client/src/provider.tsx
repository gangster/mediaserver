/**
 * tRPC Provider component.
 *
 * Wraps the application with tRPC and React Query providers.
 */

import React, { useState, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { trpc, createApiClient, createQueryClient, type ApiClientConfig } from './client.js';

/** Props for the API provider */
export interface ApiProviderProps {
  /** API client configuration */
  config: ApiClientConfig;
  /** Children to render */
  children: React.ReactNode;
}

/**
 * API Provider component.
 *
 * Provides tRPC and React Query context to the application.
 *
 * @example
 * <ApiProvider config={{ baseUrl: 'http://localhost:3000' }}>
 *   <App />
 * </ApiProvider>
 */
export function ApiProvider({ config, children }: ApiProviderProps) {
  // Create query client once
  const [queryClient] = useState(() => createQueryClient());

  // Create tRPC client with config
  const trpcClient = useMemo(() => createApiClient(config), [config]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

export default ApiProvider;

