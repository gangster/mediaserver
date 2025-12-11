/**
 * Auth API client
 *
 * Direct API calls for authentication endpoints.
 * Separate from tRPC for simpler auth flow handling.
 */

const API_URL = 'http://localhost:3000/api';

/** Auth tokens */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/** User info */
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  avatarUrl?: string | null;
}

/** Auth response */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/** API error */
export class AuthApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

/**
 * Make an auth API request using tRPC HTTP protocol
 */
async function authRequest<T>(
  procedure: string,
  method: 'GET' | 'POST',
  body?: unknown,
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {};

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = method === 'GET' && body
    ? `${API_URL}/auth.${procedure}?input=${encodeURIComponent(JSON.stringify({ json: body }))}`
    : `${API_URL}/auth.${procedure}`;

  const res = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify({ json: body }) : undefined,
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new AuthApiError(
      data.error?.message || data.error?.data?.message || 'Request failed',
      data.error?.data?.code || data.error?.code || 'UNKNOWN_ERROR',
      res.status
    );
  }

  return data.result?.data?.json as T;
}

/**
 * Auth API client
 */
export const authApi = {
  /**
   * Check if setup is required (no users exist)
   */
  needsSetup: () =>
    fetch(`${API_URL}/setup.status?batch=1&input=${encodeURIComponent(JSON.stringify({ '0': { json: null, meta: { values: ['undefined'], v: 1 } } }))}`)
      .then(res => res.json())
      .then(data => ({
        needsSetup: !data[0]?.result?.data?.json?.isComplete,
        isComplete: data[0]?.result?.data?.json?.isComplete ?? false,
      })),

  /**
   * Register a new user
   */
  register: (data: { email: string; password: string; displayName: string; inviteCode?: string }) =>
    authRequest<AuthResponse>('register', 'POST', data),

  /**
   * Login with email and password
   */
  login: (data: { email: string; password: string }) =>
    authRequest<AuthResponse>('login', 'POST', data),

  /**
   * Refresh access token
   */
  refresh: (refreshToken: string) =>
    authRequest<AuthTokens>('refresh', 'POST', { refreshToken }),

  /**
   * Logout (revoke refresh token)
   */
  logout: (accessToken: string) =>
    authRequest<{ success: boolean }>('logout', 'POST', undefined, accessToken),

  /**
   * Get current user
   */
  me: (accessToken: string) =>
    fetch(`${API_URL}/user.me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          throw new AuthApiError(
            data.error.message || 'Failed to get user',
            data.error.code || 'UNKNOWN_ERROR',
            401
          );
        }
        return data.result?.data?.json as User;
      }),
};
