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
  // #region agent log
  console.log('[DEBUG H1] authRequest called', { procedure, method, hasBody: !!body });
  // #endregion
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

  // #region agent log
  console.log('[DEBUG H1] Fetching', { url });
  // #endregion

  const res = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify({ json: body }) : undefined,
  });

  const data = await res.json();
  // #region agent log
  console.log('[DEBUG H1] Response', { ok: res.ok, status: res.status, hasError: !!data.error, dataKeys: Object.keys(data) });
  // #endregion

  if (!res.ok || data.error) {
    // tRPC with superjson can wrap errors in different structures
    const errorMessage = 
      data.error?.json?.message ||  // superjson wrapped
      data.error?.message || 
      data.error?.data?.message || 
      'Request failed';
    const errorCode = 
      data.error?.json?.data?.code ||
      data.error?.data?.code || 
      data.error?.code || 
      'UNKNOWN_ERROR';
    // #region agent log
    console.log('[DEBUG H1] Auth error', { errorMessage, errorCode, status: res.status });
    // #endregion
    throw new AuthApiError(errorMessage, errorCode, res.status);
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
  me: (accessToken: string) => {
    // tRPC GET requests need input parameter - for no input, use empty object encoded
    const input = encodeURIComponent(JSON.stringify({ '0': { json: null, meta: { values: ['undefined'], v: 1 } } }));
    return fetch(`${API_URL}/user.me?batch=1&input=${input}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(res => {
        if (!res.ok) {
          throw new AuthApiError('Failed to get user', 'UNAUTHORIZED', res.status);
        }
        return res.json();
      })
      .then(data => {
        // Handle batched response format
        const result = Array.isArray(data) ? data[0] : data;
        if (result?.error) {
          throw new AuthApiError(
            result.error.message || 'Failed to get user',
            result.error.code || 'UNKNOWN_ERROR',
            401
          );
        }
        return result?.result?.data?.json as User;
      });
  },
};
