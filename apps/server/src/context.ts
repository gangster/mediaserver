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
      const payload = await verifyAccessToken(token, env.JWT_SECRET);
      if (payload) {
        userId = payload.sub;
        userRole = payload.role;
        // Optionally fetch full user from DB here
        // user = await getUserById(db, userId);
      }
    } catch {
      // Invalid token - continue without user
    }
  }

  return {
    db,
    req,
    env,
    user,
    userId,
    userRole,
  };
}

export type { Context as TRPCContext };

