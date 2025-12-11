/**
 * Auth hook for components
 */

import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth';

/**
 * Auth hook - provides auth state and actions
 */
export function useAuth() {
  const {
    user,
    tokens,
    isLoading,
    isInitialized,
    error,
    login,
    register,
    logout,
    clearError,
    initialize,
  } = useAuthStore();

  // Initialize auth on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  return {
    user,
    isAuthenticated: !!tokens?.accessToken,
    isAdmin: user?.role === 'admin' || user?.role === 'owner',
    isOwner: user?.role === 'owner',
    isLoading,
    isInitialized,
    error,
    login,
    register,
    logout,
    clearError,
  };
}

/**
 * Require auth - returns loading state while checking
 */
export function useRequireAuth() {
  const auth = useAuth();

  return {
    ...auth,
    shouldRedirect: auth.isInitialized && !auth.isAuthenticated,
  };
}

/**
 * Require admin - returns loading state while checking
 */
export function useRequireAdmin() {
  const auth = useAuth();

  return {
    ...auth,
    shouldRedirect: auth.isInitialized && (!auth.isAuthenticated || !auth.isAdmin),
  };
}
