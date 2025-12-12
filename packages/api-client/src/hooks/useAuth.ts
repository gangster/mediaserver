/**
 * Authentication hooks.
 *
 * These hooks provide authentication functionality using tRPC.
 * They will be connected to the actual auth router when the server is built.
 */

import { trpc } from '../client.js';

/**
 * Hook for logging in.
 *
 * @example
 * const login = useLogin();
 *
 * const handleSubmit = async (data) => {
 *   try {
 *     const result = await login.mutateAsync(data);
 *     // Handle success
 *   } catch (error) {
 *     // Handle error
 *   }
 * };
 */
export function useLogin() {
  return trpc.auth.login.useMutation();
}

/**
 * Hook for registering a new user.
 */
export function useRegister() {
  return trpc.auth.register.useMutation();
}

/**
 * Hook for logging out.
 */
export function useLogout() {
  return trpc.auth.logout.useMutation();
}

/**
 * Hook for refreshing auth tokens.
 */
export function useRefreshToken() {
  return trpc.auth.refresh.useMutation();
}

/**
 * Hook for getting the current user.
 */
export function useCurrentUser() {
  return trpc.user.me.useQuery();
}

