/**
 * Subtitles router - subtitle track retrieval.
 *
 * Note: User preferences have been moved to the playback-preferences router
 * as part of the unified audio/subtitle preference system.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure } from './trpc.js';
import { uuidSchema } from '@mediaserver/config';
import { movies, episodes, eq } from '@mediaserver/db';
import { getSubtitleTracks, getLanguageName } from '../services/subtitles.js';

export const subtitlesRouter = router({
  /**
   * Get all subtitle tracks for a movie.
   */
  getMovieTracks: protectedProcedure
    .input(z.object({ movieId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      // Verify movie exists
      const movie = await ctx.db.query.movies.findFirst({
        where: eq(movies.id, input.movieId),
      });

      if (!movie) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Movie not found',
        });
      }

      const tracks = await getSubtitleTracks(ctx.db, 'movie', input.movieId);

      return tracks.map((track) => ({
        id: track.id,
        source: track.source,
        streamIndex: track.streamIndex,
        filePath: track.filePath,
        fileName: track.fileName,
        format: track.format,
        language: track.language,
        languageName: track.languageName,
        title: track.title,
        isDefault: track.isDefault,
        isForced: track.isForced,
        isSdh: track.isSdh,
        isCc: track.isCc,
        codecLongName: track.codecLongName,
      }));
    }),

  /**
   * Get all subtitle tracks for an episode.
   */
  getEpisodeTracks: protectedProcedure
    .input(z.object({ episodeId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      // Verify episode exists
      const episode = await ctx.db.query.episodes.findFirst({
        where: eq(episodes.id, input.episodeId),
      });

      if (!episode) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Episode not found',
        });
      }

      const tracks = await getSubtitleTracks(ctx.db, 'episode', input.episodeId);

      return tracks.map((track) => ({
        id: track.id,
        source: track.source,
        streamIndex: track.streamIndex,
        filePath: track.filePath,
        fileName: track.fileName,
        format: track.format,
        language: track.language,
        languageName: track.languageName,
        title: track.title,
        isDefault: track.isDefault,
        isForced: track.isForced,
        isSdh: track.isSdh,
        isCc: track.isCc,
        codecLongName: track.codecLongName,
      }));
    }),

  /**
   * Get available languages across all subtitle tracks (for filter UI).
   */
  getAvailableLanguages: protectedProcedure.query(async ({ ctx }) => {
    const tracks = await ctx.db.query.subtitleTracks.findMany({
      columns: {
        language: true,
        languageName: true,
      },
    });

    // Deduplicate and sort
    const languageMap = new Map<string, string>();
    for (const track of tracks) {
      if (track.language && !languageMap.has(track.language)) {
        languageMap.set(
          track.language,
          track.languageName ?? getLanguageName(track.language)
        );
      }
    }

    return Array.from(languageMap.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }),
});
