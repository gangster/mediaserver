/**
 * tRPC router setup and procedures.
 */

import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from '../context.js';
import type { UserRole } from '@mediaserver/core';
import { ROLE_CAPABILITIES } from '@mediaserver/core';

/**
 * Initialize tRPC with context and superjson transformer.
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Add custom error data in development
        ...(process.env['NODE_ENV'] !== 'production' && {
          stack: error.stack,
        }),
      },
    };
  },
});

/**
 * Base router and procedure exports.
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

/**
 * Auth middleware - ensures user is authenticated.
 */
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.userRole) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      userRole: ctx.userRole,
    },
  });
});

/**
 * Protected procedure - requires authentication.
 */
export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Role check middleware factory.
 */
function hasRole(allowedRoles: UserRole[]) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.userRole || !allowedRoles.includes(ctx.userRole)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
    }

    return next();
  });
}

/**
 * Admin procedure - requires admin or owner role.
 */
export const adminProcedure = protectedProcedure.use(hasRole(['owner', 'admin']));

/**
 * Owner procedure - requires owner role.
 */
export const ownerProcedure = protectedProcedure.use(hasRole(['owner']));

/**
 * Capability check middleware factory.
 */
function hasCapability(capability: keyof typeof ROLE_CAPABILITIES.owner) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.userRole) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
      });
    }

    const capabilities = ROLE_CAPABILITIES[ctx.userRole];
    if (!capabilities[capability]) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have the '${capability}' capability`,
      });
    }

    return next();
  });
}

/**
 * Creates a procedure that requires a specific capability.
 */
export function capabilityProcedure(capability: keyof typeof ROLE_CAPABILITIES.owner) {
  return protectedProcedure.use(hasCapability(capability));
}

