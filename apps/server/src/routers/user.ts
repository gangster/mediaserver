/**
 * User router.
 */

import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from './trpc.js';
import { updateProfileInputSchema, changePasswordInputSchema } from '@mediaserver/config';
import { users, eq } from '@mediaserver/db';
import { hashPassword, verifyPassword } from '../lib/auth.js';

export const userRouter = router({
  /**
   * Get current user profile.
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      preferredAudioLang: user.preferredAudioLang,
      preferredSubtitleLang: user.preferredSubtitleLang,
      enableSubtitles: user.enableSubtitles,
      language: user.language,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }),

  /**
   * Update user profile.
   */
  updateProfile: protectedProcedure
    .input(updateProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (input.displayName !== undefined) {
        updateData['displayName'] = input.displayName;
      }
      if (input.avatarUrl !== undefined) {
        updateData['avatarUrl'] = input.avatarUrl;
      }
      if (input.preferredAudioLang !== undefined) {
        updateData['preferredAudioLang'] = input.preferredAudioLang;
      }
      if (input.preferredSubtitleLang !== undefined) {
        updateData['preferredSubtitleLang'] = input.preferredSubtitleLang;
      }
      if (input.enableSubtitles !== undefined) {
        updateData['enableSubtitles'] = input.enableSubtitles;
      }
      if (input.language !== undefined) {
        updateData['language'] = input.language;
      }

      await ctx.db.update(users).set(updateData).where(eq(users.id, ctx.userId));

      const updatedUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.userId),
      });

      return {
        id: updatedUser!.id,
        email: updatedUser!.email,
        displayName: updatedUser!.displayName,
        role: updatedUser!.role,
        avatarUrl: updatedUser!.avatarUrl,
        preferredAudioLang: updatedUser!.preferredAudioLang,
        preferredSubtitleLang: updatedUser!.preferredSubtitleLang,
        enableSubtitles: updatedUser!.enableSubtitles,
        language: updatedUser!.language,
      };
    }),

  /**
   * Change password.
   */
  changePassword: protectedProcedure
    .input(changePasswordInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { currentPassword, newPassword } = input;

      // Get current user with password hash
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Verify current password
      const validPassword = await verifyPassword(user.passwordHash, currentPassword);
      if (!validPassword) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Current password is incorrect',
        });
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      await ctx.db
        .update(users)
        .set({
          passwordHash: newPasswordHash,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, ctx.userId));

      return { success: true };
    }),
});

