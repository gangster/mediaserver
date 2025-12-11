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
  // @ts-expect-error - Router not yet defined
  return trpc.auth.login.useMutation();
}

/**
 * Hook for registering a new user.
 */
export function useRegister() {
  // @ts-expect-error - Router not yet defined
  return trpc.auth.register.useMutation();
}

/**
 * Hook for logging out.
 */
export function useLogout() {
  // @ts-expect-error - Router not yet defined
  return trpc.auth.logout.useMutation();
}

/**
 * Hook for refreshing auth tokens.
 */
export function useRefreshToken() {
  // @ts-expect-error - Router not yet defined
  return trpc.auth.refresh.useMutation();
}

/**
 * Hook for getting the current user.
 */
export function useCurrentUser() {
  // @ts-expect-error - Router not yet defined
  return trpc.user.me.useQuery();
}

