/**
 * Authentication utilities.
 *
 * Handles JWT token creation and verification, password hashing.
 * Uses native crypto module to avoid third-party JWT library issues with Bun.
 */

import { createHmac, createHash } from 'crypto';
import { hash, verify } from '@node-rs/argon2';
import type { UserRole, AccessTokenPayload, RefreshTokenPayload } from '@mediaserver/core';
import { generateId } from '@mediaserver/core';

/** Argon2 options for password hashing */
const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64 MB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 threads
  outputLen: 32,
};

/** Access token expiry in seconds (15 minutes) */
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;

/** Refresh token expiry in seconds (7 days) */
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

// ============================================================================
// Custom JWT Implementation using Node's native crypto
// ============================================================================

/**
 * Base64url encode a string or buffer.
 */
function base64urlEncode(input: string | Buffer): string {
  const base64 = Buffer.from(input).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64url decode to a string.
 */
function base64urlDecode(input: string): string {
  // Restore standard base64
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * JWT header for HS256 algorithm.
 */
const JWT_HEADER = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

/**
 * Signs a JWT payload with HMAC-SHA256.
 */
function signJwt(payload: Record<string, unknown>, secret: string): string {
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const data = `${JWT_HEADER}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64urlEncode(signature)}`;
}

/**
 * Verifies and decodes a JWT.
 * Returns the payload if valid, null otherwise.
 */
function verifyJwt<T extends Record<string, unknown>>(
  token: string,
  secret: string
): T | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const header = parts[0]!;
  const payload = parts[1]!;
  const signature = parts[2]!;

  // Verify signature
  const data = `${header}.${payload}`;
  const expectedSignature = base64urlEncode(
    createHmac('sha256', secret).update(data).digest()
  );

  if (signature !== expectedSignature) {
    return null;
  }

  // Decode and parse payload
  try {
    const decoded = JSON.parse(base64urlDecode(payload)) as T;

    // Check expiration
    if (decoded.exp && typeof decoded.exp === 'number') {
      if (Date.now() >= decoded.exp * 1000) {
        return null; // Token expired
      }
    }

    return decoded;
  } catch {
    return null;
  }
}

// ============================================================================
// Password Hashing
// ============================================================================

/**
 * Hashes a password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a password against a hash.
 */
export async function verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
  try {
    return await verify(hashedPassword, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

// ============================================================================
// Token Creation
// ============================================================================

/**
 * Creates an access token JWT.
 */
export function createAccessToken(
  userId: string,
  role: UserRole,
  secret: string
): { token: string; expiresAt: Date } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ACCESS_TOKEN_EXPIRY_SECONDS;
  const expiresAt = new Date(exp * 1000);

  const payload = {
    sub: userId,
    role,
    iat: now,
    exp,
  };

  const token = signJwt(payload, secret);
  return { token, expiresAt };
}

/**
 * Creates a refresh token JWT.
 */
export function createRefreshToken(
  userId: string,
  familyId: string,
  secret: string
): { token: string; expiresAt: Date; tokenHash: string } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + REFRESH_TOKEN_EXPIRY_SECONDS;
  const expiresAt = new Date(exp * 1000);

  const payload = {
    sub: userId,
    family: familyId,
    iat: now,
    exp,
  };

  const token = signJwt(payload, secret);
  const tokenHash = hashTokenSync(token);

  return { token, expiresAt, tokenHash };
}

// ============================================================================
// Token Verification
// ============================================================================

/**
 * Verifies an access token and returns the payload.
 */
export function verifyAccessToken(
  token: string,
  secret: string
): AccessTokenPayload | null {
  const payload = verifyJwt<{
    sub: string;
    role: UserRole;
    iat: number;
    exp: number;
  }>(token, secret);

  if (!payload) {
    return null;
  }

  return {
    sub: payload.sub,
    role: payload.role,
    iat: payload.iat,
    exp: payload.exp,
  };
}

/**
 * Verifies a refresh token and returns the payload.
 */
export function verifyRefreshToken(
  token: string,
  secret: string
): RefreshTokenPayload | null {
  const payload = verifyJwt<{
    sub: string;
    family: string;
    iat: number;
    exp: number;
  }>(token, secret);

  if (!payload) {
    return null;
  }

  return {
    sub: payload.sub,
    family: payload.family,
    iat: payload.iat,
    exp: payload.exp,
  };
}

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Creates a new token family ID for refresh token rotation.
 */
export function createTokenFamily(): string {
  return generateId();
}

/**
 * Hashes a token synchronously using SHA-256.
 */
function hashTokenSync(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Compares a token with a stored hash.
 */
export function compareTokenHash(token: string, storedHash: string): boolean {
  const hash = hashTokenSync(token);
  return hash === storedHash;
}

