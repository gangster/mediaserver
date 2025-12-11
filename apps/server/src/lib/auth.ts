/**
 * Authentication utilities.
 *
 * Handles JWT token creation and verification, password hashing.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
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

/** Access token expiry (15 minutes) */
const ACCESS_TOKEN_EXPIRY = '15m';

/** Refresh token expiry (7 days) */
const REFRESH_TOKEN_EXPIRY = '7d';

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

/**
 * Creates an access token JWT.
 */
export async function createAccessToken(
  userId: string,
  role: UserRole,
  secret: string
): Promise<{ token: string; expiresAt: Date }> {
  const secretKey = new TextEncoder().encode(secret);

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  const token = await new SignJWT({ role } as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secretKey);

  return { token, expiresAt };
}

/**
 * Creates a refresh token JWT.
 */
export async function createRefreshToken(
  userId: string,
  familyId: string,
  secret: string
): Promise<{ token: string; expiresAt: Date; tokenHash: string }> {
  const secretKey = new TextEncoder().encode(secret);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const token = await new SignJWT({ family: familyId } as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(secretKey);

  // Hash the token for storage
  const tokenHash = await hashToken(token);

  return { token, expiresAt, tokenHash };
}

/**
 * Verifies an access token and returns the payload.
 */
export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<AccessTokenPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);

    return {
      sub: payload.sub as string,
      role: payload['role'] as UserRole,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies a refresh token and returns the payload.
 */
export async function verifyRefreshToken(
  token: string,
  secret: string
): Promise<RefreshTokenPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);

    return {
      sub: payload.sub as string,
      family: payload['family'] as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

/**
 * Creates a new token family ID for refresh token rotation.
 */
export function createTokenFamily(): string {
  return generateId();
}

/**
 * Hashes a token for secure storage.
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compares a token with a stored hash.
 */
export async function compareTokenHash(token: string, storedHash: string): Promise<boolean> {
  const hash = await hashToken(token);
  return hash === storedHash;
}

