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
      // #region agent log
      const lsBefore = localStorage.getItem('mediaserver-auth');
      const stateBefore = useAuthStore.getState();
      fetch('http://127.0.0.1:7243/ingest/aaaef955-942a-4465-9782-050361b336a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuth.ts:hydrate',message:'BEFORE rehydrate',data:{localStorageAuth:lsBefore,stateTokens:!!stateBefore.tokens,stateUser:!!stateBefore.user},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      
      useAuthStore.persist.rehydrate();
      
      // #region agent log
      const lsAfter = localStorage.getItem('mediaserver-auth');
      const stateAfter = useAuthStore.getState();
      fetch('http://127.0.0.1:7243/ingest/aaaef955-942a-4465-9782-050361b336a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuth.ts:hydrate',message:'AFTER rehydrate',data:{localStorageAuth:lsAfter,stateTokens:!!stateAfter.tokens,stateUser:!!stateAfter.user},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      
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

