/**
 * Authentication router.
 */

import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from './trpc.js';
import { loginInputSchema, registerInputSchema, refreshTokenInputSchema } from '@mediaserver/config';
import { generateId } from '@mediaserver/core';
import { users, refreshTokens, eq } from '@mediaserver/db';
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  createTokenFamily,
  compareTokenHash,
} from '../lib/auth.js';

export const authRouter = router({
  /**
   * Login with email and password.
   */
  login: publicProcedure.input(loginInputSchema).mutation(async ({ ctx, input }) => {
    const { email, password } = input;

    // Find user by email
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Account is disabled',
      });
    }

    // Verify password
    const validPassword = await verifyPassword(user.passwordHash, password);
    if (!validPassword) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    // Create tokens
    const { token: accessToken, expiresAt } = await createAccessToken(
      user.id,
      user.role,
      ctx.env.JWT_SECRET
    );

    const familyId = createTokenFamily();
    const {
      token: refreshToken,
      expiresAt: refreshExpiresAt,
      tokenHash,
    } = await createRefreshToken(user.id, familyId, ctx.env.JWT_REFRESH_SECRET);

    // Store refresh token
    await ctx.db.insert(refreshTokens).values({
      id: generateId(),
      userId: user.id,
      familyId,
      tokenHash,
      expiresAt: refreshExpiresAt.toISOString(),
    });

    // Update last login
    await ctx.db
      .update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, user.id));

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
    };
  }),

  /**
   * Register a new user.
   */
  register: publicProcedure.input(registerInputSchema).mutation(async ({ ctx, input }) => {
    const { email, password, displayName, inviteCode } = input;

    // Check if email already exists
    const existingUser = await ctx.db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Email already registered',
      });
    }

    // Check if this is the first user (will be owner)
    const userCount = await ctx.db.select().from(users).limit(1);
    const isFirstUser = userCount.length === 0;

    // If not first user and no invite code, check if registration is open
    if (!isFirstUser && !inviteCode) {
      // For now, require invite code for non-first users
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Registration requires an invite code',
      });
    }

    // TODO: Validate invite code if provided

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = generateId();
    const role = isFirstUser ? 'owner' : 'guest';

    await ctx.db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      role,
      isActive: true,
    });

    // Create tokens
    const { token: accessToken, expiresAt } = await createAccessToken(
      userId,
      role,
      ctx.env.JWT_SECRET
    );

    const familyId = createTokenFamily();
    const {
      token: refreshToken,
      expiresAt: refreshExpiresAt,
      tokenHash,
    } = await createRefreshToken(userId, familyId, ctx.env.JWT_REFRESH_SECRET);

    // Store refresh token
    await ctx.db.insert(refreshTokens).values({
      id: generateId(),
      userId,
      familyId,
      tokenHash,
      expiresAt: refreshExpiresAt.toISOString(),
    });

    return {
      user: {
        id: userId,
        email: email.toLowerCase(),
        displayName,
        role,
        avatarUrl: null,
      },
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
    };
  }),

  /**
   * Refresh access token using refresh token.
   */
  refresh: publicProcedure.input(refreshTokenInputSchema).mutation(async ({ ctx, input }) => {
    const { refreshToken } = input;

    // Verify refresh token
    const payload = await verifyRefreshToken(refreshToken, ctx.env.JWT_REFRESH_SECRET);
    if (!payload) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid refresh token',
      });
    }

    // Find the stored refresh token by family
    const storedToken = await ctx.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.familyId, payload.family),
    });

    if (!storedToken || storedToken.revokedAt) {
      // Potential token reuse attack - revoke entire family
      if (storedToken) {
        await ctx.db
          .update(refreshTokens)
          .set({ revokedAt: new Date().toISOString() })
          .where(eq(refreshTokens.familyId, payload.family));
      }
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid refresh token',
      });
    }

    // Verify token hash
    const hashMatches = await compareTokenHash(refreshToken, storedToken.tokenHash);
    if (!hashMatches) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid refresh token',
      });
    }

    // Get user
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user || !user.isActive) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not found or inactive',
      });
    }

    // Create new tokens (rotation)
    const { token: newAccessToken, expiresAt } = await createAccessToken(
      user.id,
      user.role,
      ctx.env.JWT_SECRET
    );

    const {
      token: newRefreshToken,
      expiresAt: refreshExpiresAt,
      tokenHash,
    } = await createRefreshToken(user.id, payload.family, ctx.env.JWT_REFRESH_SECRET);

    // Mark old token as rotated and store new one
    await ctx.db
      .update(refreshTokens)
      .set({ rotatedAt: new Date().toISOString() })
      .where(eq(refreshTokens.id, storedToken.id));

    await ctx.db.insert(refreshTokens).values({
      id: generateId(),
      userId: user.id,
      familyId: payload.family,
      tokenHash,
      expiresAt: refreshExpiresAt.toISOString(),
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: expiresAt.toISOString(),
    };
  }),

  /**
   * Logout - revokes refresh token.
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // Revoke all refresh tokens for this user
    // In a real app, you might only revoke the current session
    await ctx.db
      .update(refreshTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(refreshTokens.userId, ctx.userId));

    return { success: true };
  }),
});

