/**
 * Auth store using Zustand.
 *
 * Manages authentication state including tokens and user info.
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { SafeUser } from '@mediaserver/core';

/** Auth store state */
interface AuthState {
  /** Current user */
  user: SafeUser | null;
  /** Access token */
  token: string | null;
  /** Refresh token */
  refreshToken: string | null;
  /** Whether auth has been initialized */
  isInitialized: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
}

/** Auth store actions */
interface AuthActions {
  /** Initialize auth state from storage */
  initialize: () => Promise<void>;
  /** Set auth data after login */
  setAuth: (data: {
    user: SafeUser;
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  /** Update tokens after refresh */
  updateTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  /** Clear auth data on logout */
  clearAuth: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

/** Storage keys */
const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user',
} as const;

/**
 * Auth store.
 */
export const useAuthStore = create<AuthStore>((set, get) => ({
  // State
  user: null,
  token: null,
  refreshToken: null,
  isInitialized: false,
  isAuthenticated: false,

  // Actions
  initialize: async () => {
    try {
      const [token, refreshToken, userJson] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.USER),
      ]);

      const user = userJson ? JSON.parse(userJson) : null;

      set({
        token,
        refreshToken,
        user,
        isAuthenticated: !!token && !!user,
        isInitialized: true,
      });
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({ isInitialized: true });
    }
  },

  setAuth: async ({ user, accessToken, refreshToken }) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, accessToken),
        SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
        SecureStore.setItemAsync(STORAGE_KEYS.USER, JSON.stringify(user)),
      ]);

      set({
        user,
        token: accessToken,
        refreshToken,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Failed to save auth:', error);
      throw error;
    }
  },

  updateTokens: async (accessToken, refreshToken) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, accessToken),
        SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
      ]);

      set({
        token: accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('Failed to update tokens:', error);
      throw error;
    }
  },

  clearAuth: async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.USER),
      ]);

      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('Failed to clear auth:', error);
      throw error;
    }
  },
}));

