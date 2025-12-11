/**
 * Auth state management with Zustand
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authApi, type User, type AuthTokens } from '../lib/auth-api';

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

      initialize: async () => {
        const { tokens, refreshToken } = get();

        if (!tokens) {
          set({ isInitialized: true });
          return;
        }

        // Check if token needs refresh
        if (isTokenExpired(tokens.expiresAt)) {
          const success = await refreshToken();
          if (!success) {
            set({ isInitialized: true });
            return;
          }
        }

        // Verify token is still valid by fetching user
        try {
          const currentTokens = get().tokens;
          if (currentTokens) {
            const user = await authApi.me(currentTokens.accessToken);
            set({ user, isInitialized: true });
          } else {
            set({ isInitialized: true });
          }
        } catch (err) {
          // Only clear state on authentication errors (401)
          if (err instanceof Error && 'status' in err && (err as { status: number }).status === 401) {
            set({ user: null, tokens: null, isInitialized: true });
          } else {
            // Keep existing user data, just mark as initialized
            set({ isInitialized: true });
          }
        }
      },
    }),
    {
      name: 'mediaserver-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tokens: state.tokens,
        user: state.user,
      }),
    }
  )
);

/**
 * Get the current access token (for tRPC)
 */
export function getAccessToken(): string | null {
  return useAuthStore.getState().tokens?.accessToken ?? null;
}
