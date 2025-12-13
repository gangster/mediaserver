/**
 * Movies router - list, get, and metadata operations.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from './trpc.js';
import { moviesListInputSchema, uuidSchema } from '@mediaserver/config';
import {
  movies,
  watchProgress,
  libraryPermissions,
  genres,
  movieGenres,
  mediaRatings,
  movieCredits,
  people,
  eq,
  and,
  desc,
  asc,
  like,
  sql,
} from '@mediaserver/db';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createMediaProbe } from '@mediaserver/scanner';

/**
 * Resolution quality ranking (higher = better)
 */
function getResolutionRank(resolution: string | null): number {
  if (!resolution) return 0;
  const res = resolution.toLowerCase();
  if (res.includes('4k') || res.includes('2160')) return 5;
  if (res.includes('1080')) return 4;
  if (res.includes('720')) return 3;
  if (res.includes('480')) return 2;
  if (res.includes('360')) return 1;
  return 0;
}

/**
 * Deduplicate movies by grouping versions (same tmdbId or title+year).
 * Returns only the highest quality version of each movie.
 */
function deduplicateMovies<T extends { id: string; tmdbId: number | null; title: string; year: number | null; resolution: string | null }>(
  movieList: T[]
): T[] {
  // Group by tmdbId (if matched) or title+year (if unmatched)
  const groups = new Map<string, T[]>();
  
  for (const movie of movieList) {
    // Create a grouping key
    const key = movie.tmdbId 
      ? `tmdb:${movie.tmdbId}` 
      : `title:${movie.title.toLowerCase()}:${movie.year ?? 'unknown'}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(movie);
  }
  
  // For each group, pick the highest quality version
  const result: T[] = [];
  for (const versions of groups.values()) {
    if (versions.length === 1) {
      result.push(versions[0]!);
    } else {
      // Sort by resolution quality (descending) and pick the best
      versions.sort((a, b) => getResolutionRank(b.resolution) - getResolutionRank(a.resolution));
      result.push(versions[0]!);
    }
  }
  
  return result;
}

export const moviesRouter = router({
  /**
   * List movies with pagination, sorting, and filtering.
   */
  list: protectedProcedure.input(moviesListInputSchema).query(async ({ ctx, input }) => {
    const { libraryId, genre, year, sort, direction, limit, cursor } = input;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (libraryId) {
      conditions.push(eq(movies.libraryId, libraryId));
    }

    if (genre) {
      // Genres are stored as JSON array, search within
      conditions.push(like(movies.genres, `%"${genre}"%`));
    }

    if (year) {
      conditions.push(eq(movies.year, year));
    }

    // For non-admin users, filter by library permissions
    if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
      const permissions = await ctx.db.query.libraryPermissions.findMany({
        where: and(
          eq(libraryPermissions.userId, ctx.userId),
          eq(libraryPermissions.canView, true)
        ),
      });

      const allowedLibraryIds = permissions.map((p) => p.libraryId);
      if (allowedLibraryIds.length === 0) {
        return { items: [], nextCursor: null };
      }

      conditions.push(
        sql`${movies.libraryId} IN (${sql.join(
          allowedLibraryIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
    }

    // Build order by
    const orderFn = direction === 'desc' ? desc : asc;
    const orderColumn = {
      addedAt: movies.addedAt,
      title: movies.sortTitle,
      year: movies.year,
      rating: movies.voteAverage,
    }[sort];

    // Handle cursor pagination
    if (cursor) {
      // Cursor is the ID of the last item
      const cursorMovie = await ctx.db.query.movies.findFirst({
        where: eq(movies.id, cursor),
      });

      if (cursorMovie) {
        // Add condition to get items after cursor
        if (sort === 'addedAt') {
          const comparison = direction === 'desc' ? sql`<` : sql`>`;
          conditions.push(
            sql`${movies.addedAt} ${comparison} ${cursorMovie.addedAt}`
          );
        }
      }
    }

    // Execute query - fetch more to account for deduplication
    const results = await ctx.db.query.movies.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: orderColumn ? [orderFn(orderColumn)] : [desc(movies.addedAt)],
      limit: (limit + 1) * 3, // Fetch extra to account for duplicate versions
    });

    // Deduplicate movies (group versions, show only highest quality)
    const dedupedResults = deduplicateMovies(results);

    // Get total count of unique movies (estimate based on deduplication ratio)
    const totalRaw = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(movies)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const rawCount = totalRaw[0]?.count ?? 0;
    // Estimate unique count based on deduplication ratio
    const dedupeRatio = results.length > 0 ? dedupedResults.length / results.length : 1;
    const total = Math.round(rawCount * dedupeRatio);

    // Determine next cursor
    const hasMore = dedupedResults.length > limit;
    const items = hasMore ? dedupedResults.slice(0, limit) : dedupedResults;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return {
      items,
      nextCursor,
      total,
    };
  }),

  /**
   * Get a single movie by ID.
   */
  get: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const movie = await ctx.db.query.movies.findFirst({
        where: eq(movies.id, input.id),
      });

      if (!movie) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Movie not found',
        });
      }

      // Check library permission for non-admin users
      if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
        const permission = await ctx.db.query.libraryPermissions.findFirst({
          where: and(
            eq(libraryPermissions.userId, ctx.userId),
            eq(libraryPermissions.libraryId, movie.libraryId),
            eq(libraryPermissions.canView, true)
          ),
        });

        if (!permission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this movie',
          });
        }
      }

      // Get watch progress for this user
      const progress = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'movie'),
          eq(watchProgress.mediaId, input.id)
        ),
      });

      // Fetch ratings from media_ratings table
      const ratings = await ctx.db.query.mediaRatings.findMany({
        where: and(
          eq(mediaRatings.mediaType, 'movie'),
          eq(mediaRatings.mediaId, input.id)
        ),
      });

      // Parse JSON fields
      const genresParsed = movie.genres ? JSON.parse(movie.genres) : [];
      const mediaStreams = movie.mediaStreams ? JSON.parse(movie.mediaStreams) : [];
      const subtitlePaths = movie.subtitlePaths ? JSON.parse(movie.subtitlePaths) : [];

      return {
        ...movie,
        genres: genresParsed,
        mediaStreams,
        subtitlePaths,
        ratings: ratings.map((r) => ({
          source: r.source,
          score: r.score,
          scoreNormalized: r.scoreNormalized,
          scoreFormatted: r.scoreFormatted ?? `${r.score}`,
          voteCount: r.voteCount ?? undefined,
          updatedAt: r.updatedAt,
        })),
        watchProgress: progress
          ? {
              position: progress.position,
              duration: progress.duration,
              percentage: progress.percentage,
              isWatched: progress.isWatched,
              preferredVersionId: progress.preferredVersionId,
            }
          : null,
      };
    }),

  /**
   * Get cast and crew for a movie.
   */
  getCredits: protectedProcedure
    .input(z.object({ id: uuidSchema, maxCast: z.number().optional(), maxCrew: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const { id, maxCast = 20, maxCrew = 15 } = input;

      // Get all credits with joined person data
      const credits = await ctx.db
        .select({
          id: movieCredits.id,
          personId: movieCredits.personId,
          roleType: movieCredits.roleType,
          character: movieCredits.character,
          department: movieCredits.department,
          job: movieCredits.job,
          creditOrder: movieCredits.creditOrder,
          personName: people.name,
          profilePath: people.profilePath,
          tmdbId: people.tmdbId,
        })
        .from(movieCredits)
        .innerJoin(people, eq(movieCredits.personId, people.id))
        .where(eq(movieCredits.movieId, id))
        .orderBy(asc(movieCredits.creditOrder));

      // Separate cast and crew
      const cast = credits
        .filter((c) => c.roleType === 'cast')
        .slice(0, maxCast)
        .map((c) => ({
          id: c.personId,
          tmdbId: c.tmdbId,
          name: c.personName,
          character: c.character ?? '',
          profilePath: c.profilePath,
          order: c.creditOrder ?? 0,
        }));

      // Get key crew members (directors, writers, producers, etc.)
      const priorityRoles = [
        'Director',
        'Writer',
        'Screenplay',
        'Story',
        'Executive Producer',
        'Producer',
        'Director of Photography',
        'Original Music Composer',
        'Composer',
        'Editor',
      ];

      const allCrew = credits.filter((c) => c.roleType === 'crew');
      
      // Deduplicate by person ID, keeping highest priority role
      const crewMap = new Map<string, typeof allCrew[0]>();
      for (const member of allCrew) {
        const existing = crewMap.get(member.personId);
        if (!existing) {
          crewMap.set(member.personId, member);
        } else {
          const existingPriority = priorityRoles.indexOf(existing.job ?? '');
          const newPriority = priorityRoles.indexOf(member.job ?? '');
          if (newPriority !== -1 && (existingPriority === -1 || newPriority < existingPriority)) {
            crewMap.set(member.personId, member);
          }
        }
      }

      // Sort by role priority and limit
      const crew = Array.from(crewMap.values())
        .sort((a, b) => {
          const aPriority = priorityRoles.indexOf(a.job ?? '');
          const bPriority = priorityRoles.indexOf(b.job ?? '');
          if (aPriority === -1 && bPriority === -1) return 0;
          if (aPriority === -1) return 1;
          if (bPriority === -1) return -1;
          return aPriority - bPriority;
        })
        .slice(0, maxCrew)
        .map((c) => ({
          id: c.personId,
          tmdbId: c.tmdbId,
          name: c.personName,
          job: c.job ?? '',
          department: c.department ?? '',
          profilePath: c.profilePath,
        }));

      return { cast, crew };
    }),

  /**
   * Get all available versions (file variants) for a movie.
   * This returns different quality versions (original, transcoded 1080p, 720p, etc.)
   */
  versions: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      // First get the movie to find its grouping key
      const movie = await ctx.db.query.movies.findFirst({
        where: eq(movies.id, input.id),
      });

      if (!movie) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Movie not found',
        });
      }

      // Find all versions of this movie
      let versions;
      if (movie.tmdbId) {
        // Group by TMDB ID
        versions = await ctx.db.query.movies.findMany({
          where: eq(movies.tmdbId, movie.tmdbId),
          orderBy: [desc(movies.addedAt)],
        });
      } else {
        // Group by title + year
        versions = await ctx.db.query.movies.findMany({
          where: and(
            eq(movies.title, movie.title),
            movie.year ? eq(movies.year, movie.year) : sql`${movies.year} IS NULL`
          ),
          orderBy: [desc(movies.addedAt)],
        });
      }

      // Sort by quality (highest first)
      versions.sort((a, b) => getResolutionRank(b.resolution) - getResolutionRank(a.resolution));

      // Get user's preferred version for this movie
      const progress = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'movie'),
          eq(watchProgress.mediaId, input.id)
        ),
      });

      return versions.map((v) => ({
        id: v.id,
        filePath: v.filePath,
        resolution: v.resolution,
        videoCodec: v.videoCodec,
        audioCodec: v.audioCodec,
        duration: v.duration,
        addedAt: v.addedAt,
        isHighestQuality: v.id === versions[0]?.id,
        isPreferred: v.id === progress?.preferredVersionId,
      }));
    }),

  /**
   * Set the user's preferred version for a movie.
   * This preference is remembered and used when playing the movie.
   */
  setPreferredVersion: protectedProcedure
    .input(z.object({
      /** The "primary" movie ID (used for grouping) */
      movieId: uuidSchema,
      /** The specific version ID to prefer (can be same as movieId) */
      versionId: uuidSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify both movies exist
      const [primaryMovie, versionMovie] = await Promise.all([
        ctx.db.query.movies.findFirst({ where: eq(movies.id, input.movieId) }),
        ctx.db.query.movies.findFirst({ where: eq(movies.id, input.versionId) }),
      ]);

      if (!primaryMovie || !versionMovie) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Movie or version not found',
        });
      }

      // Get or create watch progress record
      const existing = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'movie'),
          eq(watchProgress.mediaId, input.movieId)
        ),
      });

      if (existing) {
        await ctx.db.update(watchProgress)
          .set({
            preferredVersionId: input.versionId,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(watchProgress.id, existing.id));
      } else {
        // Create new watch progress with preferred version
        const id = crypto.randomUUID();
        await ctx.db.insert(watchProgress).values({
          id,
          userId: ctx.userId,
          mediaType: 'movie',
          mediaId: input.movieId,
          preferredVersionId: input.versionId,
        });
      }

      return { success: true };
    }),

  /**
   * Get recently added movies.
   */
  recentlyAdded: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      // For non-admin users, filter by library permissions
      let libraryCondition;
      if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
        const permissions = await ctx.db.query.libraryPermissions.findMany({
          where: and(
            eq(libraryPermissions.userId, ctx.userId),
            eq(libraryPermissions.canView, true)
          ),
        });

        const allowedLibraryIds = permissions.map((p) => p.libraryId);
        if (allowedLibraryIds.length === 0) {
          return [];
        }

        libraryCondition = sql`${movies.libraryId} IN (${sql.join(
          allowedLibraryIds.map((id) => sql`${id}`),
          sql`, `
        )})`;
      }

      return ctx.db.query.movies.findMany({
        where: libraryCondition,
        orderBy: [desc(movies.addedAt)],
        limit: input.limit,
      });
    }),

  /**
   * Get all unique genres across movies.
   * Queries the normalized movieGenres join table.
   */
  genres: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .selectDistinct({ name: genres.name })
      .from(genres)
      .innerJoin(movieGenres, eq(genres.id, movieGenres.genreId))
      .orderBy(asc(genres.name));

    return results.map((r) => r.name).filter((n): n is string => n !== null);
  }),

  /**
   * Get all unique years across movies.
   */
  years: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .selectDistinct({ year: movies.year })
      .from(movies)
      .where(sql`${movies.year} IS NOT NULL`)
      .orderBy(desc(movies.year));

    return results.map((r) => r.year).filter((y): y is number => y !== null);
  }),

  /**
   * Update movie metadata manually.
   */
  updateMetadata: adminProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: z.object({
          title: z.string().optional(),
          sortTitle: z.string().optional(),
          overview: z.string().optional(),
          year: z.number().int().min(1888).max(2100).optional(),
          genres: z.array(z.string()).optional(),
          contentRating: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const movie = await ctx.db.query.movies.findFirst({
        where: eq(movies.id, input.id),
      });

      if (!movie) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Movie not found',
        });
      }

      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
        matchStatus: 'manual',
      };

      if (input.data.title !== undefined) {
        updateData['title'] = input.data.title;
      }
      if (input.data.sortTitle !== undefined) {
        updateData['sortTitle'] = input.data.sortTitle;
      }
      if (input.data.overview !== undefined) {
        updateData['overview'] = input.data.overview;
      }
      if (input.data.year !== undefined) {
        updateData['year'] = input.data.year;
      }
      if (input.data.genres !== undefined) {
        updateData['genres'] = JSON.stringify(input.data.genres);
      }
      if (input.data.contentRating !== undefined) {
        updateData['contentRating'] = input.data.contentRating;
      }

      await ctx.db.update(movies).set(updateData).where(eq(movies.id, input.id));

      return ctx.db.query.movies.findFirst({
        where: eq(movies.id, input.id),
      });
    }),

  /**
   * Mark a movie as watched.
   */
  markWatched: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const movie = await ctx.db.query.movies.findFirst({
        where: eq(movies.id, input.id),
      });

      if (!movie) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Movie not found',
        });
      }

      // Upsert watch progress
      const existing = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'movie'),
          eq(watchProgress.mediaId, input.id)
        ),
      });

      if (existing) {
        await ctx.db
          .update(watchProgress)
          .set({
            isWatched: true,
            percentage: 100,
            watchedAt: new Date().toISOString(),
            playCount: existing.playCount + 1,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(watchProgress.id, existing.id));
      } else {
        const { generateId } = await import('@mediaserver/core');
        await ctx.db.insert(watchProgress).values({
          id: generateId(),
          userId: ctx.userId,
          mediaType: 'movie',
          mediaId: input.id,
          position: movie.duration ?? 0,
          duration: movie.duration ?? 0,
          percentage: 100,
          isWatched: true,
          watchedAt: new Date().toISOString(),
          playCount: 1,
        });
      }

      return { success: true };
    }),

  /**
   * Mark a movie as unwatched.
   */
  markUnwatched: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(watchProgress)
        .set({
          isWatched: false,
          position: 0,
          percentage: 0,
          watchedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(watchProgress.userId, ctx.userId),
            eq(watchProgress.mediaType, 'movie'),
            eq(watchProgress.mediaId, input.id)
          )
        );

      return { success: true };
    }),

  /**
   * Sync genres from normalized table to JSON column for all movies.
   * This is a one-time migration helper for existing data.
   */
  syncGenres: adminProcedure.mutation(async ({ ctx }) => {
    // Get all movies with their genres from the join table
    const moviesWithGenres = await ctx.db
      .select({
        movieId: movieGenres.movieId,
        genreName: genres.name,
      })
      .from(movieGenres)
      .innerJoin(genres, eq(movieGenres.genreId, genres.id));

    // Group genres by movie
    const genresByMovie = new Map<string, string[]>();
    for (const row of moviesWithGenres) {
      if (!genresByMovie.has(row.movieId)) {
        genresByMovie.set(row.movieId, []);
      }
      if (row.genreName) {
        genresByMovie.get(row.movieId)!.push(row.genreName);
      }
    }

    // Update each movie's genres JSON column
    let updated = 0;
    for (const [movieId, genreNames] of genresByMovie) {
      await ctx.db
        .update(movies)
        .set({ genres: JSON.stringify(genreNames) })
        .where(eq(movies.id, movieId));
      updated++;
    }

    return { updated };
  }),

  /**
   * Get detailed file statistics for a movie.
   * Uses ffprobe to extract comprehensive technical info from the file.
   */
  getFileStats: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const movie = await ctx.db.query.movies.findFirst({
        where: eq(movies.id, input.id),
      });

      if (!movie) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Movie not found',
        });
      }

      const filePath = movie.filePath ?? '';
      const fileName = path.basename(filePath);
      const container = path.extname(fileName).slice(1).toLowerCase() || 'unknown';

      // Default values
      let fileSize = 0;
      let lastModified = movie.updatedAt ?? new Date().toISOString();
      let duration = movie.duration ?? 0;
      let bitRate = 0;

      // Video stream info
      const videoStreams: Array<{
        index: number;
        codec: string;
        width: number;
        height: number;
        frameRate: number;
        bitRate?: number;
        pixelFormat?: string;
        resolution: string;
        aspectRatio: string;
        hdr?: string;
      }> = [];

      // Audio stream info
      const audioStreams: Array<{
        index: number;
        codec: string;
        channels: number;
        channelLayout: string;
        sampleRate: number;
        bitRate?: number;
        language?: string;
        title?: string;
      }> = [];

      // Subtitle stream info
      const subtitleStreams: Array<{
        index: number;
        codec: string;
        language?: string;
        title?: string;
        forced: boolean;
      }> = [];

      // Try to get file stats
      try {
        const stats = await fs.stat(filePath);
        fileSize = stats.size;
        lastModified = stats.mtime.toISOString();
      } catch {
        // File might not be accessible
      }

      // Try to probe the file with ffprobe for detailed info
      try {
        const probe = createMediaProbe();
        const probeResult = await probe.probe(filePath);

        duration = probeResult.duration ?? duration;
        bitRate = probeResult.bitrate ?? 0;

        // Process streams
        for (const stream of probeResult.streams) {
          if (stream.type === 'video') {
            const width = stream.width ?? 0;
            const height = stream.height ?? 0;

            // Detect HDR type
            let hdr: string | undefined;
            if (stream.hdr) {
              // Check for specific HDR formats based on color transfer
              hdr = 'HDR10'; // Default HDR label
            }

            videoStreams.push({
              index: stream.index,
              codec: stream.codec?.toUpperCase() ?? 'Unknown',
              width,
              height,
              frameRate: stream.frameRate ?? 0,
              pixelFormat: stream.pixelFormat,
              resolution: `${width}x${height}`,
              aspectRatio: width && height ? `${(width / height).toFixed(2)}:1` : 'Unknown',
              hdr,
            });
          } else if (stream.type === 'audio') {
            // Format channel layout nicely
            let channelLayout = stream.channelLayout ?? '';
            if (!channelLayout && stream.channels) {
              // Create a layout based on channel count
              if (stream.channels === 1) channelLayout = 'mono';
              else if (stream.channels === 2) channelLayout = 'stereo';
              else if (stream.channels === 6) channelLayout = '5.1';
              else if (stream.channels === 8) channelLayout = '7.1';
              else channelLayout = `${stream.channels}.0`;
            }

            audioStreams.push({
              index: stream.index,
              codec: stream.codec?.toUpperCase() ?? 'Unknown',
              channels: stream.channels ?? 0,
              channelLayout,
              sampleRate: stream.sampleRate ?? 0,
              language: stream.language,
              title: stream.title,
            });
          } else if (stream.type === 'subtitle') {
            subtitleStreams.push({
              index: stream.index,
              codec: stream.codec?.toUpperCase() ?? 'Unknown',
              language: stream.language,
              title: stream.title,
              forced: stream.forced ?? false,
            });
          }
        }
      } catch (err) {
        // ffprobe failed - fall back to stored mediaStreams if available
        console.error('ffprobe failed:', err);
        
        const mediaStreams = movie.mediaStreams ? JSON.parse(movie.mediaStreams) : [];
        
        for (const s of mediaStreams) {
          if (s.codec_type === 'video') {
            const width = s.width ?? 0;
            const height = s.height ?? 0;
            const frameRateStr = s.r_frame_rate ?? s.avg_frame_rate ?? '0/1';
            const parts = frameRateStr.split('/').map(Number);
            const frameRate = parts[1] ? (parts[0] ?? 0) / parts[1] : 0;

            let hdr: string | undefined;
            if (s.color_primaries === 'bt2020') {
              hdr = s.color_transfer === 'smpte2084' ? 'HDR10' : s.color_transfer === 'arib-std-b67' ? 'HLG' : 'HDR';
            }

            videoStreams.push({
              index: s.index ?? videoStreams.length,
              codec: s.codec_name?.toUpperCase() ?? 'Unknown',
              width,
              height,
              frameRate,
              bitRate: s.bit_rate ? parseInt(s.bit_rate) : undefined,
              pixelFormat: s.pix_fmt,
              resolution: `${width}x${height}`,
              aspectRatio: s.display_aspect_ratio ?? (height ? `${(width / height).toFixed(2)}:1` : 'Unknown'),
              hdr,
            });
          } else if (s.codec_type === 'audio') {
            audioStreams.push({
              index: s.index ?? audioStreams.length,
              codec: s.codec_name?.toUpperCase() ?? 'Unknown',
              channels: s.channels ?? 0,
              channelLayout: s.channel_layout ?? (s.channels ? `${s.channels}.0` : 'Unknown'),
              sampleRate: s.sample_rate ? parseInt(s.sample_rate) : 0,
              bitRate: s.bit_rate ? parseInt(s.bit_rate) : undefined,
              language: s.tags?.language,
              title: s.tags?.title,
            });
          } else if (s.codec_type === 'subtitle') {
            subtitleStreams.push({
              index: s.index ?? subtitleStreams.length,
              codec: s.codec_name?.toUpperCase() ?? 'Unknown',
              language: s.tags?.language,
              title: s.tags?.title,
              forced: s.disposition?.forced === 1,
            });
          }
        }
      }

      return {
        filePath,
        fileName,
        fileSize,
        lastModified,
        container,
        duration: duration || undefined,
        bitRate: bitRate || undefined,
        videoStreams,
        audioStreams,
        subtitleStreams,
      };
    }),
});

