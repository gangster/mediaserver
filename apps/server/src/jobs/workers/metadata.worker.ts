/**
 * Metadata worker.
 *
 * Processes metadata refresh and identification jobs using BullMQ.
 */

import type { Job } from 'bullmq';
import type { Database } from '@mediaserver/db';
import { movies, tvShows, eq } from '@mediaserver/db';
import { createLogger } from '../../lib/logger.js';
import type {
  MetadataJobData,
  MetadataResult,
  RefreshMovieJobData,
  RefreshShowJobData,
  IdentifyMediaJobData,
  RefreshLibraryMetadataJobData,
} from '../types.js';
import {
  fetchMovieMetadata,
  fetchShowMetadata,
  identifyMovie,
  identifyShow,
} from '../../services/metadata.js';

const log = createLogger('info');

/**
 * Create metadata worker processor.
 */
export function createMetadataProcessor(db: Database) {
  return async (job: Job<MetadataJobData, MetadataResult>): Promise<MetadataResult> => {
    const { data } = job;

    log.info({ jobId: job.id, type: data.type }, 'Processing metadata job');

    switch (data.type) {
      case 'refresh_movie':
        return processRefreshMovie(job as Job<RefreshMovieJobData, MetadataResult>, db);
      case 'refresh_show':
        return processRefreshShow(job as Job<RefreshShowJobData, MetadataResult>, db);
      case 'identify_media':
        return processIdentifyMedia(job as Job<IdentifyMediaJobData, MetadataResult>, db);
      case 'refresh_library':
        return processRefreshLibrary(job as Job<RefreshLibraryMetadataJobData, MetadataResult>, db);
      default:
        throw new Error(`Unknown metadata job type: ${(data as MetadataJobData).type}`);
    }
  };
}

/**
 * Process movie metadata refresh.
 */
async function processRefreshMovie(
  job: Job<RefreshMovieJobData, MetadataResult>,
  db: Database
): Promise<MetadataResult> {
  const { movieId, movieTitle, force } = job.data;

  await job.updateProgress({ percentage: 10, message: 'Fetching movie details...' });

  const movie = await db.query.movies.findFirst({
    where: eq(movies.id, movieId),
  });

  if (!movie) {
    throw new Error(`Movie not found: ${movieId}`);
  }

  // Skip if already matched and not forced
  if (movie.tmdbId && !force) {
    return {
      matched: true,
      title: movie.title,
      year: movie.year ?? undefined,
      provider: 'tmdb',
      externalId: String(movie.tmdbId),
    };
  }

  await job.updateProgress({ percentage: 30, message: 'Searching for match...' });

  const result = await fetchMovieMetadata(db, movieId, movieTitle, movie.year ?? undefined);

  await job.updateProgress({ percentage: 100, message: 'Complete' });

  return {
    matched: result.matched,
    title: result.title,
    year: result.year,
    provider: result.provider,
    externalId: result.externalId,
  };
}

/**
 * Process show metadata refresh.
 */
async function processRefreshShow(
  job: Job<RefreshShowJobData, MetadataResult>,
  db: Database
): Promise<MetadataResult> {
  const { showId, showTitle, force } = job.data;

  await job.updateProgress({ percentage: 10, message: 'Fetching show details...' });

  const show = await db.query.tvShows.findFirst({
    where: eq(tvShows.id, showId),
  });

  if (!show) {
    throw new Error(`Show not found: ${showId}`);
  }

  // Skip if already matched and not forced
  if (show.tmdbId && !force) {
    return {
      matched: true,
      title: show.title,
      year: show.year ?? undefined,
      provider: 'tmdb',
      externalId: String(show.tmdbId),
    };
  }

  await job.updateProgress({ percentage: 30, message: 'Searching for match...' });

  const result = await fetchShowMetadata(db, showId, showTitle, show.year ?? undefined);

  await job.updateProgress({ percentage: 100, message: 'Complete' });

  return {
    matched: result.matched,
    title: result.title,
    year: result.year,
    provider: result.provider,
    externalId: result.externalId,
  };
}

/**
 * Process manual media identification.
 */
async function processIdentifyMedia(
  job: Job<IdentifyMediaJobData, MetadataResult>,
  db: Database
): Promise<MetadataResult> {
  const { mediaType, mediaId, externalId, provider } = job.data;

  await job.updateProgress({ percentage: 10, message: 'Identifying media...' });

  let result: MetadataResult;

  if (mediaType === 'movie') {
    const fetchResult = await identifyMovie(db, mediaId, externalId, provider);
    result = {
      matched: fetchResult.matched,
      title: fetchResult.title,
      year: fetchResult.year,
      provider: fetchResult.provider,
      externalId: fetchResult.externalId,
    };
  } else {
    const fetchResult = await identifyShow(db, mediaId, externalId, provider);
    result = {
      matched: fetchResult.matched,
      title: fetchResult.title,
      year: fetchResult.year,
      provider: fetchResult.provider,
      externalId: fetchResult.externalId,
    };
  }

  await job.updateProgress({ percentage: 100, message: 'Complete' });

  return result;
}

/**
 * Process library-wide metadata refresh.
 */
async function processRefreshLibrary(
  job: Job<RefreshLibraryMetadataJobData, MetadataResult>,
  db: Database
): Promise<MetadataResult> {
  const { libraryId, libraryName, force } = job.data;

  await job.updateProgress({ percentage: 5, message: `Refreshing metadata for ${libraryName}...` });

  // Get all movies/shows in library that need metadata
  const libraryMovies = await db.query.movies.findMany({
    where: eq(movies.libraryId, libraryId),
  });

  const libraryShows = await db.query.tvShows.findMany({
    where: eq(tvShows.libraryId, libraryId),
  });

  const totalItems = libraryMovies.length + libraryShows.length;
  let processedItems = 0;
  let matchedCount = 0;

  // Process movies
  for (const movie of libraryMovies) {
    if (!movie.tmdbId || force) {
      try {
        await fetchMovieMetadata(db, movie.id, movie.title, movie.year ?? undefined);
        matchedCount++;
      } catch (error) {
        log.error({ error, movieId: movie.id }, 'Error refreshing movie metadata');
      }
    }
    processedItems++;
    await job.updateProgress({
      percentage: Math.round((processedItems / totalItems) * 90) + 5,
      message: `Processing ${processedItems}/${totalItems}...`,
      processedItems,
      totalItems,
    });
  }

  // Process shows
  for (const show of libraryShows) {
    if (!show.tmdbId || force) {
      try {
        await fetchShowMetadata(db, show.id, show.title, show.year ?? undefined);
        matchedCount++;
      } catch (error) {
        log.error({ error, showId: show.id }, 'Error refreshing show metadata');
      }
    }
    processedItems++;
    await job.updateProgress({
      percentage: Math.round((processedItems / totalItems) * 90) + 5,
      message: `Processing ${processedItems}/${totalItems}...`,
      processedItems,
      totalItems,
    });
  }

  await job.updateProgress({ percentage: 100, message: 'Complete' });

  log.info(
    { jobId: job.id, libraryId, totalItems, matchedCount },
    'Library metadata refresh completed'
  );

  return {
    matched: true,
    title: libraryName,
  };
}
