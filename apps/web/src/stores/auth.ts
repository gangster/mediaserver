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
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login({ email, password });
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
        
        // Already initialized - don't re-run
        if (state.isInitialized) {
          return;
        }

        const { tokens } = state;

        if (!tokens) {
          console.log('[Auth] No tokens found, marking initialized');
          set({ isInitialized: true });
          return;
        }

        // Check if token needs refresh
        if (isTokenExpired(tokens.expiresAt)) {
          console.log('[Auth] Token expired, attempting refresh...');
          const success = await state.refreshToken();
          if (!success) {
            console.log('[Auth] Token refresh failed during init');
            set({ user: null, tokens: null, isInitialized: true });
            return;
          }
        }

        // Always verify token is still valid by fetching user
        // This catches cases where server restarted with new JWT secret
        try {
          const currentTokens = get().tokens;
          if (currentTokens) {
            console.log('[Auth] Verifying token by fetching user...');
            const fetchedUser = await authApi.me(currentTokens.accessToken);
            set({ user: fetchedUser, isInitialized: true });
            console.log('[Auth] Token verified, user loaded');
          } else {
            set({ isInitialized: true });
          }
        } catch (err) {
          console.log('[Auth] Token verification failed:', err instanceof Error ? err.message : String(err));
          // Only clear state on explicit authentication errors (401)
          if (err instanceof AuthApiError && err.status === 401) {
            console.log('[Auth] 401 error - clearing tokens, user will be redirected to login');
            set({ user: null, tokens: null, isInitialized: true });
          } else {
            // Keep existing user/tokens on network errors, just mark as initialized
            // User can still try to use the app - requests will fail if tokens invalid
            console.log('[Auth] Network error, keeping existing auth state');
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
 * Proactively refreshes token if it's about to expire.
 */
export async function getAccessToken(): Promise<string | null> {
  await ensureHydrated();
  const state = useAuthStore.getState();
  const tokens = state.tokens;
  
  if (!tokens) {
    return null;
  }
  
  // Proactively refresh if token is expired or about to expire (5 minute buffer)
  if (isTokenExpiringSoon(tokens.expiresAt, 5 * 60 * 1000)) {
    console.log('[Auth] Token expiring soon, attempting refresh...');
    const success = await state.refreshToken();
    if (success) {
      // Return the new token
      return useAuthStore.getState().tokens?.accessToken ?? null;
    }
    // Refresh failed, return null (will trigger 401 and logout)
    console.log('[Auth] Token refresh failed');
    return null;
  }
  
  return tokens.accessToken;
}

/**
 * Check if token is expiring soon (within buffer milliseconds)
 */
function isTokenExpiringSoon(expiresAt: string, bufferMs: number): boolean {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  return expiry - now < bufferMs;
}

/**
 * Handle 401 errors by clearing auth state.
 * Call this when an API returns 401 Unauthorized.
 */
export function handleAuthError(): void {
  console.log('[Auth] Handling auth error - clearing tokens');
  useAuthStore.setState({ user: null, tokens: null });
}
