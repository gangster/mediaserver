/**
 * Auth state management with Zustand
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authApi, AuthApiError, type User, type AuthTokens } from '../lib/auth-api';

/** Auth state */
interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

/** Auth actions */
interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, inviteCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
  initialize: () => Promise<void>;
  /** Set auth state directly (used by setup wizard) */
  setAuth: (user: User, tokens: AuthTokens) => void;
}

/** Combined auth store */
type AuthStore = AuthState & AuthActions;

/**
 * Check if token is expired (with 30 second buffer)
 */
function isTokenExpired(expiresAt: string): boolean {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  return expiry - now < 30000; // 30 second buffer
}

/**
 * Auth store
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      tokens: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      // Actions
      login: async (email, password) => {
        // #region agent log
        console.log('[DEBUG H1] auth.ts login called', { email });
        // #endregion
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login({ email, password });
          // #region agent log
          console.log('[DEBUG H1,H2] authApi.login response', { hasUser: !!response.user, hasAccessToken: !!response.accessToken });
          // #endregion
          set({
            user: response.user,
            tokens: {
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
              expiresAt: response.expiresAt,
            },
            isLoading: false,
          });
          // #region agent log
          const lsNow = typeof window !== 'undefined' ? localStorage.getItem('mediaserver-auth') : null;
          console.log('[DEBUG H2] After set() in login, localStorage:', lsNow);
          // #endregion
        } catch (err) {
          // #region agent log
          console.log('[DEBUG H1] login error', { error: err instanceof Error ? err.message : String(err) });
          // #endregion
          const message = err instanceof Error ? err.message : 'Login failed';
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      register: async (email, password, displayName, inviteCode) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register({ email, password, displayName, inviteCode });
          set({
            user: response.user,
            tokens: {
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
              expiresAt: response.expiresAt,
            },
            isLoading: false,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Registration failed';
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      logout: async () => {
        const { tokens } = get();
        set({ isLoading: true });
        try {
          if (tokens) {
            await authApi.logout(tokens.accessToken);
          }
        } catch {
          // Ignore logout errors
        } finally {
          set({
            user: null,
            tokens: null,
            isLoading: false,
            error: null,
          });
        }
      },

      refreshToken: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) return false;

        try {
          const newTokens = await authApi.refresh(tokens.refreshToken);
          set({
            tokens: {
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
              expiresAt: newTokens.expiresAt,
            },
          });
          return true;
        } catch {
          // Refresh failed - clear auth state
          set({ user: null, tokens: null });
          return false;
        }
      },

      clearError: () => set({ error: null }),

      setAuth: (user, tokens) => {
        set({
          user,
          tokens,
          isInitialized: true,
          isLoading: false,
          error: null,
        });
      },

      initialize: async () => {
        const state = get();
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/aaaef955-942a-4465-9782-050361b336a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:initialize',message:'Initialize called',data:{isInitialized:state.isInitialized,hasTokens:!!state.tokens,hasUser:!!state.user},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
        
        // Already initialized - don't re-run
        if (state.isInitialized) {
          return;
        }

        const { tokens, user } = state;

        if (!tokens) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/aaaef955-942a-4465-9782-050361b336a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:initialize',message:'No tokens, marking initialized',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
          // #endregion
          set({ isInitialized: true });
          return;
        }

        // If we already have user data (e.g., from setAuth), just mark as initialized
        // Don't need to verify - tokens were just set
        if (user) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/aaaef955-942a-4465-9782-050361b336a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:initialize',message:'User exists, skipping API verify',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
          // #endregion
          set({ isInitialized: true });
          return;
        }

        // Check if token needs refresh
        if (isTokenExpired(tokens.expiresAt)) {
          const success = await state.refreshToken();
          if (!success) {
            set({ isInitialized: true });
            return;
          }
        }

        // Verify token is still valid by fetching user
        try {
          const currentTokens = get().tokens;
          if (currentTokens) {
            const fetchedUser = await authApi.me(currentTokens.accessToken);
            set({ user: fetchedUser, isInitialized: true });
          } else {
            set({ isInitialized: true });
          }
        } catch (err) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/aaaef955-942a-4465-9782-050361b336a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:initialize',message:'API error in initialize',data:{error:err instanceof Error ? err.message : String(err),status:(err as any)?.status},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
          // #endregion
          // Only clear state on explicit authentication errors (401)
          if (err instanceof AuthApiError && err.status === 401) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/aaaef955-942a-4465-9782-050361b336a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:initialize',message:'401 error - CLEARING TOKENS',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
            // #endregion
            set({ user: null, tokens: null, isInitialized: true });
          } else {
            // Keep existing tokens on network errors, just mark as initialized
            // User can still try to use the app - requests will fail if tokens invalid
            set({ isInitialized: true });
          }
        }
      },
    }),
    {
      name: 'mediaserver-auth',
      storage: createJSONStorage(() => {
        // SSR-safe localStorage access
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      partialize: (state) => ({
        tokens: state.tokens,
        user: state.user,
      }),
      skipHydration: true, // Don't hydrate on server
    }
  )
);

/** Promise that resolves when hydration is complete */
let hydrationPromise: Promise<void> | null = null;

/**
 * Ensure the auth store is hydrated from localStorage.
 * Returns a promise that resolves when hydration is complete.
 */
function ensureHydrated(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  
  if (!hydrationPromise) {
    hydrationPromise = new Promise<void>((resolve) => {
      // Check if already hydrated
      const unsubFinishHydration = useAuthStore.persist.onFinishHydration(() => {
        unsubFinishHydration();
        resolve();
      });
      
      // Trigger hydration
      useAuthStore.persist.rehydrate();
      
      // If hydration is already complete (sync), the callback may not fire
      // So also resolve after a microtask
      Promise.resolve().then(() => {
        if (useAuthStore.persist.hasHydrated()) {
          resolve();
        }
      });
    });
  }
  
  return hydrationPromise;
}

/**
 * Get the current access token (for tRPC)
 * Ensures store is hydrated before reading.
 */
export async function getAccessToken(): Promise<string | null> {
  await ensureHydrated();
  return useAuthStore.getState().tokens?.accessToken ?? null;
}
