/**
 * tRPC client setup.
 *
 * This file sets up the tRPC client for use with React Query.
 * The actual AppRouter type will be imported from the server package.
 */

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink, loggerLink, TRPCClientError } from '@trpc/client';
import { QueryClient } from '@tanstack/react-query';
import superjson from 'superjson';

/**
 * Placeholder for AppRouter type.
 * This will be replaced with the actual type from the server package.
 * Import like: import type { AppRouter } from '@mediaserver/server';
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppRouter {}

/**
 * tRPC React hooks.
 * Use these throughout the application for API calls.
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * API client configuration options.
 */
export interface ApiClientConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** Function to get the current auth token */
  getToken?: () => string | null | Promise<string | null>;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Creates a tRPC client instance.
 *
 * @param config - Client configuration
 */
export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, getToken, debug = false, headers = {} } = config;

  return trpc.createClient({
    links: [
      // Logger link for debugging
      loggerLink({
        enabled: () => debug,
        colorMode: 'ansi',
      }),
      // HTTP batch link for requests
      httpBatchLink({
        url: `${baseUrl}/api`,
        transformer: superjson,
        async headers() {
          const token = await getToken?.();
          return {
            ...headers,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          };
        },
      }),
    ],
  });
}

/**
 * Default query client configuration.
 */
export const defaultQueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: (failureCount: number, error: unknown) => {
        // Don't retry on 4xx errors
        if (error instanceof TRPCClientError) {
          const status = error.data?.httpStatus;
          if (status && status >= 400 && status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
};

/**
 * Creates a configured QueryClient instance.
 */
export function createQueryClient() {
  return new QueryClient(defaultQueryClientConfig);
}

