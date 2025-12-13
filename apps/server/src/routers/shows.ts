/**
 * TV Shows router - list, get, seasons, episodes.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure } from './trpc.js';
import { showsListInputSchema, uuidSchema } from '@mediaserver/config';
import {
  tvShows,
  seasons,
  episodes,
  watchProgress,
  libraryPermissions,
  genres,
  showGenres,
  mediaRatings,
  showCredits,
  people,
  providerEpisodes,
  eq,
  and,
  desc,
  asc,
  like,
  sql,
} from '@mediaserver/db';

/** Guest star from provider episode data */
export interface GuestStar {
  id: string;
  name: string;
  character?: string;
  profilePath?: string | null;
  order?: number;
}

/** Crew member from provider episode data */
export interface CrewMember {
  id: string;
  name: string;
  job: string;
  department: string;
  profilePath?: string | null;
}

export const showsRouter = router({
  /**
   * List TV shows with pagination, sorting, and filtering.
   */
  list: protectedProcedure.input(showsListInputSchema).query(async ({ ctx, input }) => {
    const { libraryId, genre, status, sort, direction, limit, cursor } = input;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (libraryId) {
      conditions.push(eq(tvShows.libraryId, libraryId));
    }

    if (genre) {
      conditions.push(like(tvShows.genres, `%"${genre}"%`));
    }

    if (status) {
      conditions.push(eq(tvShows.status, status));
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
        sql`${tvShows.libraryId} IN (${sql.join(
          allowedLibraryIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
    }

    // Build order by
    const orderFn = direction === 'desc' ? desc : asc;
    const orderColumn = {
      addedAt: tvShows.addedAt,
      title: tvShows.sortTitle,
      year: tvShows.year,
      rating: tvShows.voteAverage,
    }[sort];

    // Handle cursor pagination
    if (cursor) {
      const cursorShow = await ctx.db.query.tvShows.findFirst({
        where: eq(tvShows.id, cursor),
      });

      if (cursorShow) {
        if (sort === 'addedAt') {
          const comparison = direction === 'desc' ? sql`<` : sql`>`;
          conditions.push(
            sql`${tvShows.addedAt} ${comparison} ${cursorShow.addedAt}`
          );
        }
      }
    }

    // Execute query
    const results = await ctx.db.query.tvShows.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: orderColumn ? [orderFn(orderColumn)] : [desc(tvShows.addedAt)],
      limit: limit + 1,
    });

    // Get total count (for stats display)
    const countResult = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(tvShows)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = countResult[0]?.count ?? 0;

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, -1) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return {
      items,
      nextCursor,
      total,
    };
  }),

  /**
   * Get a single TV show by ID.
   */
  get: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const show = await ctx.db.query.tvShows.findFirst({
        where: eq(tvShows.id, input.id),
      });

      if (!show) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'TV show not found',
        });
      }

      // Check library permission for non-admin users
      if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
        const permission = await ctx.db.query.libraryPermissions.findFirst({
          where: and(
            eq(libraryPermissions.userId, ctx.userId),
            eq(libraryPermissions.libraryId, show.libraryId),
            eq(libraryPermissions.canView, true)
          ),
        });

        if (!permission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this show',
          });
        }
      }

      // Get seasons for this show
      const showSeasons = await ctx.db.query.seasons.findMany({
        where: eq(seasons.showId, input.id),
        orderBy: [asc(seasons.seasonNumber)],
      });

      // Fetch ratings from media_ratings table
      const ratings = await ctx.db.query.mediaRatings.findMany({
        where: and(
          eq(mediaRatings.mediaType, 'show'),
          eq(mediaRatings.mediaId, input.id)
        ),
      });

      // Parse JSON fields
      const genresParsed = show.genres ? JSON.parse(show.genres) : [];

      return {
        ...show,
        genres: genresParsed,
        seasons: showSeasons,
        ratings: ratings.map((r) => ({
          source: r.source,
          score: r.score,
          scoreNormalized: r.scoreNormalized,
          scoreFormatted: r.scoreFormatted ?? `${r.score}`,
          voteCount: r.voteCount ?? undefined,
          updatedAt: r.updatedAt,
        })),
      };
    }),

  /**
   * Get cast and crew for a TV show.
   */
  getCredits: protectedProcedure
    .input(z.object({ id: uuidSchema, maxCast: z.number().optional(), maxCrew: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const { id, maxCast = 20, maxCrew = 15 } = input;

      // Get all credits with joined person data
      const credits = await ctx.db
        .select({
          id: showCredits.id,
          personId: showCredits.personId,
          roleType: showCredits.roleType,
          character: showCredits.character,
          department: showCredits.department,
          job: showCredits.job,
          creditOrder: showCredits.creditOrder,
          personName: people.name,
          profilePath: people.profilePath,
          tmdbId: people.tmdbId,
        })
        .from(showCredits)
        .innerJoin(people, eq(showCredits.personId, people.id))
        .where(eq(showCredits.showId, id))
        .orderBy(asc(showCredits.creditOrder));

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

      // Get key crew members (creators, showrunners, producers, etc.)
      const priorityRoles = [
        'Creator',
        'Executive Producer',
        'Showrunner',
        'Producer',
        'Director',
        'Writer',
        'Director of Photography',
        'Original Music Composer',
        'Composer',
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
   * Get a season with its episodes.
   */
  getSeason: protectedProcedure
    .input(
      z.object({
        showId: uuidSchema,
        seasonNumber: z.number().int().min(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const show = await ctx.db.query.tvShows.findFirst({
        where: eq(tvShows.id, input.showId),
      });

      if (!show) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'TV show not found',
        });
      }

      const season = await ctx.db.query.seasons.findFirst({
        where: and(
          eq(seasons.showId, input.showId),
          eq(seasons.seasonNumber, input.seasonNumber)
        ),
      });

      if (!season) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Season not found',
        });
      }

      // Get episodes for this season
      const allSeasonEpisodes = await ctx.db.query.episodes.findMany({
        where: eq(episodes.seasonId, season.id),
        orderBy: [asc(episodes.episodeNumber)],
      });

      // Deduplicate episodes by episode number (pick highest quality version)
      const qualityOrder: Record<string, number> = { '4K': 5, '2160p': 5, '1080p': 4, '720p': 3, '480p': 2, '360p': 1 };
      const getQualityScore = (res: string | null): number => {
        if (!res) return 0;
        for (const [key, score] of Object.entries(qualityOrder)) {
          if (res.toUpperCase().includes(key.toUpperCase())) return score;
        }
        return 0;
      };

      const seasonEpisodesMap = new Map<number, typeof allSeasonEpisodes[0]>();
      for (const ep of allSeasonEpisodes) {
        const existing = seasonEpisodesMap.get(ep.episodeNumber);
        if (!existing || getQualityScore(ep.resolution) > getQualityScore(existing.resolution)) {
          seasonEpisodesMap.set(ep.episodeNumber, ep);
        }
      }
      const seasonEpisodes = Array.from(seasonEpisodesMap.values()).sort(
        (a, b) => a.episodeNumber - b.episodeNumber
      );

      // Get watch progress for all episodes
      const episodeIds = seasonEpisodes.map((e) => e.id);
      const progressRecords =
        episodeIds.length > 0
          ? await ctx.db.query.watchProgress.findMany({
              where: and(
                eq(watchProgress.userId, ctx.userId),
                eq(watchProgress.mediaType, 'episode'),
                sql`${watchProgress.mediaId} IN (${sql.join(
                  episodeIds.map((id) => sql`${id}`),
                  sql`, `
                )})`
              ),
            })
          : [];

      const progressMap = new Map(progressRecords.map((p) => [p.mediaId, p]));

      // Attach progress to episodes
      const episodesWithProgress = seasonEpisodes.map((episode) => {
        const progress = progressMap.get(episode.id);
        const mediaStreams = episode.mediaStreams
          ? JSON.parse(episode.mediaStreams)
          : [];
        const subtitlePaths = episode.subtitlePaths
          ? JSON.parse(episode.subtitlePaths)
          : [];

        return {
          ...episode,
          mediaStreams,
          subtitlePaths,
          watchProgress: progress
            ? {
                position: progress.position,
                duration: progress.duration,
                percentage: progress.percentage,
                isWatched: progress.isWatched,
              }
            : null,
        };
      });

      return {
        ...season,
        show: {
          id: show.id,
          title: show.title,
          posterPath: show.posterPath,
        },
        episodes: episodesWithProgress,
      };
    }),

  /**
   * Get a single episode with full detail including navigation and season episodes.
   */
  getEpisode: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const episode = await ctx.db.query.episodes.findFirst({
        where: eq(episodes.id, input.id),
      });

      if (!episode) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Episode not found',
        });
      }

      // Get show info with genres
      const show = await ctx.db.query.tvShows.findFirst({
        where: eq(tvShows.id, episode.showId),
      });

      if (!show) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Show not found for episode',
        });
      }

      // Parse show genres
      const showGenresList = show.genres ? JSON.parse(show.genres) : [];

      const season = await ctx.db.query.seasons.findFirst({
        where: eq(seasons.id, episode.seasonId),
      });

      // Check library permission
      if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
        const permission = await ctx.db.query.libraryPermissions.findFirst({
          where: and(
            eq(libraryPermissions.userId, ctx.userId),
            eq(libraryPermissions.libraryId, show.libraryId),
            eq(libraryPermissions.canView, true)
          ),
        });

        if (!permission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this episode',
          });
        }
      }

      // Get watch progress for this episode
      const progress = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'episode'),
          eq(watchProgress.mediaId, input.id)
        ),
      });

      // Get all episodes in this season for navigation and episode strip
      const allSeasonEpisodes = await ctx.db.query.episodes.findMany({
        where: eq(episodes.seasonId, episode.seasonId),
        orderBy: [asc(episodes.episodeNumber)],
      });

      // Deduplicate episodes by episode number (pick highest quality version)
      const qualityOrder: Record<string, number> = { '4K': 5, '2160p': 5, '1080p': 4, '720p': 3, '480p': 2, '360p': 1 };
      const getQualityScore = (res: string | null): number => {
        if (!res) return 0;
        for (const [key, score] of Object.entries(qualityOrder)) {
          if (res.toUpperCase().includes(key.toUpperCase())) return score;
        }
        return 0;
      };

      const seasonEpisodesMap = new Map<number, typeof allSeasonEpisodes[0]>();
      for (const ep of allSeasonEpisodes) {
        const existing = seasonEpisodesMap.get(ep.episodeNumber);
        if (!existing || getQualityScore(ep.resolution) > getQualityScore(existing.resolution)) {
          seasonEpisodesMap.set(ep.episodeNumber, ep);
        }
      }
      const seasonEpisodes = Array.from(seasonEpisodesMap.values()).sort(
        (a, b) => a.episodeNumber - b.episodeNumber
      );

      // Get watch progress for all season episodes
      const allProgress = await ctx.db.query.watchProgress.findMany({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'episode'),
        ),
      });
      const progressMap = new Map(allProgress.map((p) => [p.mediaId, p]));

      // Find previous and next episodes (across seasons if needed)
      const allShowEpisodesRaw = await ctx.db.query.episodes.findMany({
        where: eq(episodes.showId, episode.showId),
        orderBy: [asc(episodes.seasonNumber), asc(episodes.episodeNumber)],
      });

      // Deduplicate all show episodes for navigation
      const allShowEpisodesMap = new Map<string, typeof allShowEpisodesRaw[0]>();
      for (const ep of allShowEpisodesRaw) {
        const key = `${ep.seasonNumber}-${ep.episodeNumber}`;
        const existing = allShowEpisodesMap.get(key);
        if (!existing || getQualityScore(ep.resolution) > getQualityScore(existing.resolution)) {
          allShowEpisodesMap.set(key, ep);
        }
      }
      const allShowEpisodes = Array.from(allShowEpisodesMap.values()).sort(
        (a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber
      );

      const currentIndex = allShowEpisodes.findIndex((e) => e.id === episode.id);
      const previousEpisode = currentIndex > 0 ? allShowEpisodes[currentIndex - 1] : null;
      const nextEpisode = currentIndex < allShowEpisodes.length - 1 ? allShowEpisodes[currentIndex + 1] : null;

      const mediaStreams = episode.mediaStreams
        ? JSON.parse(episode.mediaStreams)
        : [];
      const subtitlePaths = episode.subtitlePaths
        ? JSON.parse(episode.subtitlePaths)
        : [];

      // Get guest stars from provider_episodes
      const providerEpisode = await ctx.db.query.providerEpisodes.findFirst({
        where: and(
          eq(providerEpisodes.episodeId, episode.id),
          eq(providerEpisodes.provider, 'tmdb')
        ),
      });

      // Parse guest stars and crew from provider data
      let guestStars: GuestStar[] = [];
      let episodeCrew: CrewMember[] = [];
      
      if (providerEpisode?.guestStars) {
        try {
          guestStars = JSON.parse(providerEpisode.guestStars);
        } catch {
          // ignore parse errors
        }
      }
      if (providerEpisode?.crew) {
        try {
          episodeCrew = JSON.parse(providerEpisode.crew);
        } catch {
          // ignore parse errors
        }
      }

      return {
        ...episode,
        mediaStreams,
        subtitlePaths,
        guestStars,
        episodeCrew,
        show: {
          id: show.id,
          title: show.title,
          posterPath: show.posterPath,
          backdropPath: show.backdropPath,
          genres: showGenresList,
        },
        season: season
          ? {
              id: season.id,
              seasonNumber: season.seasonNumber,
              name: season.name,
            }
          : null,
        watchProgress: progress
          ? {
              position: progress.position,
              duration: progress.duration,
              percentage: progress.percentage,
              isWatched: progress.isWatched,
            }
          : null,
        // Episode navigation
        previousEpisode: previousEpisode
          ? {
              id: previousEpisode.id,
              seasonNumber: previousEpisode.seasonNumber,
              episodeNumber: previousEpisode.episodeNumber,
              title: previousEpisode.title,
              stillPath: previousEpisode.stillPath,
            }
          : null,
        nextEpisode: nextEpisode
          ? {
              id: nextEpisode.id,
              seasonNumber: nextEpisode.seasonNumber,
              episodeNumber: nextEpisode.episodeNumber,
              title: nextEpisode.title,
              stillPath: nextEpisode.stillPath,
            }
          : null,
        // Season episodes for strip
        seasonEpisodes: seasonEpisodes.map((e) => {
          const ep = progressMap.get(e.id);
          return {
            id: e.id,
            episodeNumber: e.episodeNumber,
            title: e.title,
            stillPath: e.stillPath,
            runtime: e.runtime,
            watchProgress: ep
              ? {
                  percentage: ep.percentage,
                  isWatched: ep.isWatched,
                }
              : null,
          };
        }),
      };
    }),

  /**
   * Get the next episode to watch for a show.
   */
  getNextEpisode: protectedProcedure
    .input(z.object({ showId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      // Get all episodes for this show
      const showEpisodes = await ctx.db.query.episodes.findMany({
        where: eq(episodes.showId, input.showId),
        orderBy: [asc(episodes.seasonNumber), asc(episodes.episodeNumber)],
      });

      if (showEpisodes.length === 0) {
        return null;
      }

      // Get watch progress for all episodes
      const episodeIds = showEpisodes.map((e) => e.id);
      const progressRecords = await ctx.db.query.watchProgress.findMany({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'episode'),
          sql`${watchProgress.mediaId} IN (${sql.join(
            episodeIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        ),
      });

      const progressMap = new Map(progressRecords.map((p) => [p.mediaId, p]));

      // Find the first unwatched episode or the first episode with progress < 90%
      for (const episode of showEpisodes) {
        const progress = progressMap.get(episode.id);

        if (!progress) {
          // Never watched, this is the next one
          return episode;
        }

        if (!progress.isWatched && progress.percentage < 90) {
          // In progress, this is the next one
          return {
            ...episode,
            resumePosition: progress.position,
          };
        }
      }

      // All episodes watched, return null or first episode
      return null;
    }),

  /**
   * Get recently added shows.
   */
  recentlyAdded: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
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

        libraryCondition = sql`${tvShows.libraryId} IN (${sql.join(
          allowedLibraryIds.map((id) => sql`${id}`),
          sql`, `
        )})`;
      }

      return ctx.db.query.tvShows.findMany({
        where: libraryCondition,
        orderBy: [desc(tvShows.addedAt)],
        limit: input.limit,
      });
    }),

  /**
   * Get all unique genres across TV shows.
   * Queries the normalized showGenres join table.
   */
  genres: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .selectDistinct({ name: genres.name })
      .from(genres)
      .innerJoin(showGenres, eq(genres.id, showGenres.genreId))
      .orderBy(asc(genres.name));

    return results.map((r) => r.name).filter((n): n is string => n !== null);
  }),

  /**
   * Mark an episode as watched.
   */
  markEpisodeWatched: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const episode = await ctx.db.query.episodes.findFirst({
        where: eq(episodes.id, input.id),
      });

      if (!episode) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Episode not found',
        });
      }

      const existing = await ctx.db.query.watchProgress.findFirst({
        where: and(
          eq(watchProgress.userId, ctx.userId),
          eq(watchProgress.mediaType, 'episode'),
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
          mediaType: 'episode',
          mediaId: input.id,
          position: episode.duration ?? 0,
          duration: episode.duration ?? 0,
          percentage: 100,
          isWatched: true,
          watchedAt: new Date().toISOString(),
          playCount: 1,
        });
      }

      return { success: true };
    }),

  /**
   * Mark an episode as unwatched.
   */
  markEpisodeUnwatched: protectedProcedure
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
            eq(watchProgress.mediaType, 'episode'),
            eq(watchProgress.mediaId, input.id)
          )
        );

      return { success: true };
    }),

  /**
   * Mark all episodes in a season as watched.
   */
  markSeasonWatched: protectedProcedure
    .input(
      z.object({
        showId: uuidSchema,
        seasonNumber: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const season = await ctx.db.query.seasons.findFirst({
        where: and(
          eq(seasons.showId, input.showId),
          eq(seasons.seasonNumber, input.seasonNumber)
        ),
      });

      if (!season) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Season not found',
        });
      }

      const seasonEpisodes = await ctx.db.query.episodes.findMany({
        where: eq(episodes.seasonId, season.id),
      });

      const { generateId } = await import('@mediaserver/core');
      const now = new Date().toISOString();

      for (const episode of seasonEpisodes) {
        const existing = await ctx.db.query.watchProgress.findFirst({
          where: and(
            eq(watchProgress.userId, ctx.userId),
            eq(watchProgress.mediaType, 'episode'),
            eq(watchProgress.mediaId, episode.id)
          ),
        });

        if (existing) {
          await ctx.db
            .update(watchProgress)
            .set({
              isWatched: true,
              percentage: 100,
              watchedAt: now,
              playCount: existing.playCount + 1,
              updatedAt: now,
            })
            .where(eq(watchProgress.id, existing.id));
        } else {
          await ctx.db.insert(watchProgress).values({
            id: generateId(),
            userId: ctx.userId,
            mediaType: 'episode',
            mediaId: episode.id,
            position: episode.duration ?? 0,
            duration: episode.duration ?? 0,
            percentage: 100,
            isWatched: true,
            watchedAt: now,
            playCount: 1,
          });
        }
      }

      return { success: true, episodesMarked: seasonEpisodes.length };
    }),
});

