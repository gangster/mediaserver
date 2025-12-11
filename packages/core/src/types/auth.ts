/**
 * Authentication-related types.
 */

import type { ISODateString, UUID } from './common.js';
import type { SafeUser, UserRole } from './user.js';

/** Login credentials */
export interface LoginInput {
  email: string;
  password: string;
}

/** Registration input */
export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  inviteCode?: string;
}

/** Authentication response */
export interface AuthResponse {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: ISODateString;
}

/** Token refresh input */
export interface RefreshTokenInput {
  refreshToken: string;
}

/** Token refresh response */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: ISODateString;
}

/** Access token payload (JWT) */
export interface AccessTokenPayload {
  /** Subject - User ID */
  sub: UUID;
  /** User role */
  role: UserRole;
  /** Issued at */
  iat: number;
  /** Expiration */
  exp: number;
}

/** Refresh token payload (JWT) */
export interface RefreshTokenPayload {
  /** Subject - User ID */
  sub: UUID;
  /** Token family ID for rotation detection */
  family: string;
  /** Issued at */
  iat: number;
  /** Expiration */
  exp: number;
}

/** Session information */
export interface Session {
  id: UUID;
  userId: UUID;
  createdAt: ISODateString;
  lastActivityAt: ISODateString;
  userAgent?: string;
  ipAddress?: string;
  isCurrent: boolean;
}

/** Password change input */
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/** Password reset request input */
export interface RequestPasswordResetInput {
  email: string;
}

/** Password reset input */
export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

