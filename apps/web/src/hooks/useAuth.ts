/**
 * Auth hook for components
 */

import { useEffect, useState } from 'react';
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
  
  const [hydrated, setHydrated] = useState(false);

  // Hydrate store on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      useAuthStore.persist.rehydrate();
      setHydrated(true);
    }
  }, []);

  // Initialize auth after hydration
  useEffect(() => {
    if (hydrated && !isInitialized) {
      initialize();
    }
  }, [hydrated, isInitialized, initialize]);

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
