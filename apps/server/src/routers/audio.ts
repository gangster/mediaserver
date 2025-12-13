/**
 * Audio router - audio track retrieval.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure } from './trpc.js';
import { uuidSchema } from '@mediaserver/config';
import { movies, episodes, eq } from '@mediaserver/db';
import { getAudioTracks, getAvailableAudioLanguages } from '../services/audio-tracks.js';

export const audioRouter = router({
  /**
   * Get all audio tracks for a movie.
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

      const tracks = await getAudioTracks(ctx.db, 'movie', input.movieId);

      return tracks.map((track) => ({
        id: track.id,
        streamIndex: track.streamIndex,
        codec: track.codec,
        codecLongName: track.codecLongName,
        language: track.language,
        languageName: track.languageName,
        title: track.title,
        channels: track.channels,
        channelLayout: track.channelLayout,
        sampleRate: track.sampleRate,
        isDefault: track.isDefault,
        isOriginal: track.isOriginal,
        isCommentary: track.isCommentary,
        isDescriptive: track.isDescriptive,
      }));
    }),

  /**
   * Get all audio tracks for an episode.
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

      const tracks = await getAudioTracks(ctx.db, 'episode', input.episodeId);

      return tracks.map((track) => ({
        id: track.id,
        streamIndex: track.streamIndex,
        codec: track.codec,
        codecLongName: track.codecLongName,
        language: track.language,
        languageName: track.languageName,
        title: track.title,
        channels: track.channels,
        channelLayout: track.channelLayout,
        sampleRate: track.sampleRate,
        isDefault: track.isDefault,
        isOriginal: track.isOriginal,
        isCommentary: track.isCommentary,
        isDescriptive: track.isDescriptive,
      }));
    }),

  /**
   * Get available languages across all audio tracks (for filter UI).
   */
  getAvailableLanguages: protectedProcedure.query(async ({ ctx }) => {
    return getAvailableAudioLanguages(ctx.db);
  }),
});

