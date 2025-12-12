/**
 * Libraries router - CRUD operations and scanning.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  router,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  capabilityProcedure,
} from './trpc.js';
import {
  createLibraryInputSchema,
  updateLibraryInputSchema,
  grantLibraryPermissionInputSchema,
  idSchema,
} from '@mediaserver/config';
import { generateId } from '@mediaserver/core';
import {
  libraries,
  libraryPermissions,
  movies,
  tvShows,
  backgroundJobs,
  eq,
  and,
  count,
  sql,
} from '@mediaserver/db';

export const librariesRouter = router({
  /**
   * Check if a path exists and get info about it.
   * Used by setup wizard to validate library paths.
   */
  checkPath: publicProcedure
    .input(z.object({ path: z.string().min(1) }))
    .query(async ({ input }) => {
      const targetPath = input.path;

      // Check the target path
      let exists = false;
      let isDirectory = false;
      let isWritable = false;

      try {
        const stats = await fs.stat(targetPath);
        exists = true;
        isDirectory = stats.isDirectory();

        // Check if writable by attempting to access with write permission
        if (isDirectory) {
          try {
            await fs.access(targetPath, fs.constants.W_OK);
            isWritable = true;
          } catch {
            isWritable = false;
          }
        }
      } catch {
        // Path doesn't exist
      }

      // Check parent directory
      const parentPath = path.dirname(targetPath);
      let parentExists = false;
      let parentWritable = false;

      try {
        const parentStats = await fs.stat(parentPath);
        parentExists = parentStats.isDirectory();

        if (parentExists) {
          try {
            await fs.access(parentPath, fs.constants.W_OK);
            parentWritable = true;
          } catch {
            parentWritable = false;
          }
        }
      } catch {
        // Parent doesn't exist
      }

      return {
        exists,
        isDirectory,
        isWritable,
        parentExists,
        parentWritable,
      };
    }),

  /**
   * Create a directory at the given path.
   * Used by setup wizard to create library directories.
   */
  createPath: publicProcedure
    .input(z.object({ path: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const targetPath = input.path;

      // Validate path is absolute
      if (!path.isAbsolute(targetPath)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Path must be absolute (start with /)',
        });
      }

      // Security: Don't allow creating directories in sensitive locations
      const disallowedPaths = ['/', '/bin', '/sbin', '/usr', '/etc', '/var', '/root', '/sys', '/proc'];
      if (disallowedPaths.includes(targetPath)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot create directory in this location',
        });
      }

      try {
        // Create directory recursively
        await fs.mkdir(targetPath, { recursive: true });

        return {
          success: true,
          message: `Created directory: ${targetPath}`,
        };
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create directory: ${errMessage}`,
        });
      }
    }),

  /**
   * List all libraries the user has access to.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    let libraryList;

    // Owner and admin can see all libraries
    if (ctx.userRole === 'owner' || ctx.userRole === 'admin') {
      libraryList = await ctx.db.query.libraries.findMany({
        orderBy: (libraries, { asc }) => [asc(libraries.name)],
      });
    } else {
    // Other users see only libraries they have permission for
    const permissions = await ctx.db.query.libraryPermissions.findMany({
      where: and(
        eq(libraryPermissions.userId, ctx.userId),
        eq(libraryPermissions.canView, true)
      ),
    });

    const libraryIds = permissions.map((p) => p.libraryId);
    if (libraryIds.length === 0) {
      return [];
    }

      libraryList = await ctx.db.query.libraries.findMany({
      where: sql`${libraries.id} IN (${sql.join(
        libraryIds.map((id) => sql`${id}`),
        sql`, `
      )})`,
      orderBy: (libraries, { asc }) => [asc(libraries.name)],
    });
    }

    // Add item counts for each library
    const librariesWithCounts = await Promise.all(
      libraryList.map(async (library) => {
        let itemCount = 0;
        if (library.type === 'movie') {
          const result = await ctx.db.select({ count: count() }).from(movies).where(eq(movies.libraryId, library.id));
          itemCount = result[0]?.count ?? 0;
        } else {
          const result = await ctx.db.select({ count: count() }).from(tvShows).where(eq(tvShows.libraryId, library.id));
          itemCount = result[0]?.count ?? 0;
        }
        return { ...library, itemCount };
      })
    );

    return librariesWithCounts;
  }),

  /**
   * Get a single library by ID.
   */
  get: protectedProcedure
    .input(z.object({ id: idSchema }))
    .query(async ({ ctx, input }) => {
      const library = await ctx.db.query.libraries.findFirst({
        where: eq(libraries.id, input.id),
      });

      if (!library) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Library not found',
        });
      }

      // Check permission for non-admin users
      if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
        const permission = await ctx.db.query.libraryPermissions.findFirst({
          where: and(
            eq(libraryPermissions.userId, ctx.userId),
            eq(libraryPermissions.libraryId, input.id),
            eq(libraryPermissions.canView, true)
          ),
        });

        if (!permission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this library',
          });
        }
      }

      return library;
    }),

  /**
   * Get library statistics.
   */
  stats: protectedProcedure
    .input(z.object({ id: idSchema }))
    .query(async ({ ctx, input }) => {
      const library = await ctx.db.query.libraries.findFirst({
        where: eq(libraries.id, input.id),
      });

      if (!library) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Library not found',
        });
      }

      if (library.type === 'movie') {
        const [movieCount] = await ctx.db
          .select({ count: count() })
          .from(movies)
          .where(eq(movies.libraryId, input.id));

        return {
          type: 'movie' as const,
          movieCount: movieCount?.count ?? 0,
        };
      } else {
        const [showCount] = await ctx.db
          .select({ count: count() })
          .from(tvShows)
          .where(eq(tvShows.libraryId, input.id));

        return {
          type: 'tv' as const,
          showCount: showCount?.count ?? 0,
        };
      }
    }),

  /**
   * Create a new library.
   */
  create: capabilityProcedure('canCreateLibraries')
    .input(createLibraryInputSchema)
    .mutation(async ({ ctx, input }) => {
      const libraryId = generateId();

      await ctx.db.insert(libraries).values({
        id: libraryId,
        name: input.name,
        type: input.type,
        paths: JSON.stringify(input.paths),
        enabled: input.enabled,
      });

      const library = await ctx.db.query.libraries.findFirst({
        where: eq(libraries.id, libraryId),
      });

      return library!;
    }),

  /**
   * Update a library.
   */
  update: adminProcedure
    .input(
      z.object({
        id: idSchema,
        data: updateLibraryInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.libraries.findFirst({
        where: eq(libraries.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Library not found',
        });
      }

      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (input.data.name !== undefined) {
        updateData['name'] = input.data.name;
      }
      if (input.data.paths !== undefined) {
        updateData['paths'] = JSON.stringify(input.data.paths);
      }
      if (input.data.enabled !== undefined) {
        updateData['enabled'] = input.data.enabled;
      }

      await ctx.db
        .update(libraries)
        .set(updateData)
        .where(eq(libraries.id, input.id));

      return ctx.db.query.libraries.findFirst({
        where: eq(libraries.id, input.id),
      });
    }),

  /**
   * Delete a library.
   */
  delete: capabilityProcedure('canDeleteLibraries')
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.libraries.findFirst({
        where: eq(libraries.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Library not found',
        });
      }

      // Delete will cascade to media items
      await ctx.db.delete(libraries).where(eq(libraries.id, input.id));

      return { success: true };
    }),

  /**
   * Start a library scan.
   */
  scan: capabilityProcedure('canScanLibraries')
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const library = await ctx.db.query.libraries.findFirst({
        where: eq(libraries.id, input.id),
      });

      if (!library) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Library not found',
        });
      }

      // Check if a scan is already running
      const existingJob = await ctx.db.query.backgroundJobs.findFirst({
        where: and(
          eq(backgroundJobs.type, 'scan'),
          eq(backgroundJobs.targetType, 'library'),
          eq(backgroundJobs.targetId, input.id),
          eq(backgroundJobs.status, 'active')
        ),
      });

      if (existingJob) {
        return { jobId: existingJob.id, alreadyRunning: true };
      }

      // Create a new scan job
      const jobId = generateId();
      await ctx.db.insert(backgroundJobs).values({
        id: jobId,
        type: 'scan',
        targetType: 'library',
        targetId: input.id,
        status: 'waiting',
        createdBy: ctx.userId,
      });

      // Run the scan asynchronously (don't await)
      const db = ctx.db;
      import('../services/scan.js').then(({ runLibraryScan }) => {
        runLibraryScan(db, jobId, input.id).catch((err) => {
          console.error('Scan failed:', err);
        });
      });

      return { jobId, alreadyRunning: false };
    }),

  /**
   * Start scanning all libraries.
   */
  scanAll: capabilityProcedure('canScanLibraries')
    .mutation(async ({ ctx }) => {
      // Get all libraries
      const allLibraries = await ctx.db.query.libraries.findMany({
        where: eq(libraries.enabled, true),
      });

      let count = 0;

      for (const library of allLibraries) {
        // Check if a scan is already running
        const existingJob = await ctx.db.query.backgroundJobs.findFirst({
          where: and(
            eq(backgroundJobs.type, 'scan'),
            eq(backgroundJobs.targetType, 'library'),
            eq(backgroundJobs.targetId, library.id),
            eq(backgroundJobs.status, 'active')
          ),
        });

        if (existingJob) {
          continue; // Skip this library
        }

        // Create a new scan job
        const jobId = generateId();
        await ctx.db.insert(backgroundJobs).values({
          id: jobId,
          type: 'scan',
          targetType: 'library',
          targetId: library.id,
          status: 'waiting',
          createdBy: ctx.userId,
        });

        // Run the scan asynchronously (don't await)
        const db = ctx.db;
        import('../services/scan.js').then(({ runLibraryScan }) => {
          runLibraryScan(db, jobId, library.id).catch((err) => {
            console.error('Scan failed:', err);
          });
        });

        count++;
      }

      return { count };
    }),

  /**
   * Get scan status for a library.
   */
  scanStatus: protectedProcedure
    .input(z.object({ id: idSchema }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.query.backgroundJobs.findFirst({
        where: and(
          eq(backgroundJobs.type, 'scan'),
          eq(backgroundJobs.targetType, 'library'),
          eq(backgroundJobs.targetId, input.id)
        ),
        orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
      });

      if (!job) {
        return null;
      }

      return {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        progressMessage: job.progressMessage,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
      };
    }),

  /**
   * Grant library permission to a user.
   */
  grantPermission: adminProcedure
    .input(grantLibraryPermissionInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify library exists
      const library = await ctx.db.query.libraries.findFirst({
        where: eq(libraries.id, input.libraryId),
      });

      if (!library) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Library not found',
        });
      }

      // Check if permission already exists
      const existing = await ctx.db.query.libraryPermissions.findFirst({
        where: and(
          eq(libraryPermissions.userId, input.userId),
          eq(libraryPermissions.libraryId, input.libraryId)
        ),
      });

      if (existing) {
        // Update existing permission
        await ctx.db
          .update(libraryPermissions)
          .set({
            canView: input.canView,
            canWatch: input.canWatch,
            canDownload: input.canDownload,
            maxContentRating: input.maxContentRating,
            expiresAt: input.expiresAt,
          })
          .where(eq(libraryPermissions.id, existing.id));

        return { success: true, updated: true };
      }

      // Create new permission
      await ctx.db.insert(libraryPermissions).values({
        id: generateId(),
        userId: input.userId,
        libraryId: input.libraryId,
        canView: input.canView,
        canWatch: input.canWatch,
        canDownload: input.canDownload,
        maxContentRating: input.maxContentRating,
        grantedBy: ctx.userId,
        expiresAt: input.expiresAt,
      });

      return { success: true, updated: false };
    }),

  /**
   * Revoke library permission from a user.
   */
  revokePermission: adminProcedure
    .input(
      z.object({
        userId: idSchema,
        libraryId: idSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(libraryPermissions)
        .where(
          and(
            eq(libraryPermissions.userId, input.userId),
            eq(libraryPermissions.libraryId, input.libraryId)
          )
        );

      return { success: true };
    }),

  /**
   * List permissions for a library.
   */
  listPermissions: adminProcedure
    .input(z.object({ libraryId: idSchema }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.libraryPermissions.findMany({
        where: eq(libraryPermissions.libraryId, input.libraryId),
      });
    }),
});

