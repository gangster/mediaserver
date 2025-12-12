/**
 * tRPC context creation.
 *
 * The context is available in all tRPC procedures and contains
 * the database connection, current user, and other request-specific data.
 */

import type { Database } from '@mediaserver/db';
import type { User, UserRole } from '@mediaserver/core';
import type { Env } from '@mediaserver/config';
import { verifyAccessToken } from './lib/auth.js';

/** Context creation options */
export interface CreateContextOptions {
  db: Database;
  req: Request;
  env: Env;
}

/** tRPC context type */
export interface Context {
  db: Database;
  req: Request;
  env: Env;
  user: User | null;
  userId: string | null;
  userRole: UserRole | null;
}

/**
 * Creates the tRPC context for a request.
 *
 * Extracts the user from the Authorization header if present.
 */
export async function createContext(opts: CreateContextOptions): Promise<Context> {
  const { db, req, env } = opts;

  // Try to get user from Authorization header
  const authHeader = req.headers.get('Authorization');
  const user: User | null = null;
  let userId: string | null = null;
  let userRole: UserRole | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token, env.JWT_SECRET);
      if (payload) {
        userId = payload.sub;
        userRole = payload.role;
        console.log('[AUTH] Token verified:', { userId, userRole });
      }
    } catch (err) {
      // Invalid token - continue without user
      console.log('[AUTH] Token verification failed:', err instanceof Error ? err.message : err);
    }
  } else {
    console.log('[AUTH] No Bearer token in Authorization header:', authHeader ? 'header present but wrong format' : 'no header');
  }

  // Create a plain object copy of env to avoid serialization issues
  const envCopy = {
    DATABASE_URL: env.DATABASE_URL,
    JWT_SECRET: env.JWT_SECRET,
    JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
    PORT: env.PORT,
    HOST: env.HOST,
    NODE_ENV: env.NODE_ENV,
    LOG_LEVEL: env.LOG_LEVEL,
    DATA_DIR: env.DATA_DIR,
    TRANSCODES_DIR: env.TRANSCODES_DIR,
    CACHE_DIR: env.CACHE_DIR,
    LOGS_DIR: env.LOGS_DIR,
    TMDB_API_KEY: env.TMDB_API_KEY,
    SENTRY_DSN: env.SENTRY_DSN,
    TAILSCALE_AUTHKEY: env.TAILSCALE_AUTHKEY,
    LICENSE_SERVER_URL: env.LICENSE_SERVER_URL,
    DATABASE_AUTH_TOKEN: env.DATABASE_AUTH_TOKEN,
    REDIS_URL: env.REDIS_URL,
  } as typeof env;

  return {
    db,
    req,
    env: envCopy,
    user,
    userId,
    userRole,
  };
}

export type { Context as TRPCContext };

