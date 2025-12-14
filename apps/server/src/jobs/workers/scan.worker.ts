/**
 * Library scan worker.
 *
 * Processes library scan jobs using BullMQ.
 */

import type { Job } from 'bullmq';
import type { Database } from '@mediaserver/db';
import { libraries, eq } from '@mediaserver/db';
import { scanLibrary as runScanner } from '@mediaserver/scanner';
import type { ScanProgress, ScanResult as ScannerResult, ParsedMovie, ParsedEpisode } from '@mediaserver/scanner';
import { createLogger } from '../../lib/logger.js';
import type { ScanJobData, ScanResult, ScanLibraryJobData } from '../types.js';
import { fetchPendingMovieMetadata, fetchPendingShowMetadata } from '../../services/metadata.js';
import { scanSubtitles } from '../../services/subtitles.js';
import { saveAudioTracks } from '../../services/audio-tracks.js';
import { movies, tvShows, seasons, episodes, and } from '@mediaserver/db';
import { dirname } from 'node:path';

const log = createLogger('info');

/** Generate a unique ID */
function generateId(): string {
  return crypto.randomUUID();
}

/** Type guard for ParsedMovie */
function isMovieParsed(parsed: ParsedMovie | ParsedEpisode): parsed is ParsedMovie {
  return 'title' in parsed && !('showTitle' in parsed);
}

/** Type guard for ParsedEpisode */
function isEpisodeParsed(parsed: ParsedMovie | ParsedEpisode): parsed is ParsedEpisode {
  return 'showTitle' in parsed;
}

/**
 * Create scan worker processor.
 */
export function createScanProcessor(db: Database) {
  return async (job: Job<ScanJobData, ScanResult>): Promise<ScanResult> => {
    const { data } = job;

    log.info({ jobId: job.id, type: data.type }, 'Processing scan job');

    if (data.type === 'scan_library') {
      return processScanLibrary(job as Job<ScanLibraryJobData, ScanResult>, db);
    } else {
      // scan_file type - not implemented yet
      throw new Error(`Unsupported scan job type: ${data.type}`);
    }
  };
}

/**
 * Process a library scan job.
 */
async function processScanLibrary(
  job: Job<ScanLibraryJobData, ScanResult>,
  db: Database
): Promise<ScanResult> {
  const { libraryId, libraryName } = job.data;

  // Get library details
  const library = await db.query.libraries.findFirst({
    where: eq(libraries.id, libraryId),
  });

  if (!library) {
    throw new Error(`Library not found: ${libraryId}`);
  }

  await job.updateProgress({ percentage: 5, message: 'Starting scan...' });

  // Parse paths from JSON
  const paths = JSON.parse(library.paths) as string[];

  // Run scanner with progress updates
  const results = await runScanner(
    libraryId,
    paths,
    library.type as 'movie' | 'tv',
    async (progress: ScanProgress) => {
      await job.updateProgress({
        percentage: Math.round(progress.progress * 0.5) + 5, // 5-55%
        message: progress.currentFile
          ? `Scanning: ${progress.currentFile}`
          : `${progress.status} (${progress.itemsScanned}/${progress.itemsTotal})`,
      });
    }
  );

  await job.updateProgress({
    percentage: 55,
    message: 'Saving to database...',
  });

  // Process and save results to database
  const stats = await processResults(db, libraryId, library.type as 'movie' | 'tv', results, job);

  await job.updateProgress({
    percentage: 85,
    message: 'Fetching metadata for new items...',
  });

  // Fetch metadata for new items
  try {
    if (library.type === 'movie') {
      await fetchPendingMovieMetadata(db, libraryId);
    } else if (library.type === 'tv') {
      await fetchPendingShowMetadata(db, libraryId);
    }
  } catch (error) {
    log.error({ error, libraryId }, 'Error fetching metadata');
    // Don't fail the job for metadata errors
  }

  // Update library scan timestamp
  await db
    .update(libraries)
    .set({ lastScannedAt: new Date().toISOString() })
    .where(eq(libraries.id, libraryId));

  await job.updateProgress({
    percentage: 100,
    message: `Complete: ${stats.added} added, ${stats.updated} updated, ${stats.errors} errors`,
  });

  log.info(
    { jobId: job.id, libraryId, libraryName, ...stats },
    'Library scan completed'
  );

  return { added: stats.added, updated: stats.updated, removed: 0, errors: stats.errors };
}

interface ProcessStats {
  added: number;
  updated: number;
  errors: number;
}

/**
 * Processes scan results and saves them to the database.
 */
async function processResults(
  db: Database,
  libraryId: string,
  type: 'movie' | 'tv',
  results: ScannerResult[],
  job: Job
): Promise<ProcessStats> {
  const stats: ProcessStats = { added: 0, updated: 0, errors: 0 };
  const total = results.length;

  if (type === 'movie') {
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result) continue;
      
      // Update progress periodically
      if (i % 5 === 0) {
        await job.updateProgress({
          percentage: 55 + Math.round((i / total) * 25), // 55-80%
          message: `Processing ${i + 1}/${total} items...`,
        });
      }

      if (result.error) {
        stats.errors++;
        continue;
      }

      try {
        const parsed = result.parsed;
        const title = isMovieParsed(parsed) ? parsed.title : 'Unknown';
        const year = parsed.year;

        // Check if movie already exists by file path
        const existing = await db.query.movies.findFirst({
          where: eq(movies.filePath, result.path),
        });

        if (existing) {
          // Update existing movie
          await db.update(movies)
            .set({
              title: title || existing.title,
              year: year ?? existing.year,
              duration: result.probe?.duration ?? existing.duration,
              videoCodec: result.probe?.videoCodec ?? existing.videoCodec,
              audioCodec: result.probe?.audioCodec ?? existing.audioCodec,
              resolution: result.probe?.resolution ?? existing.resolution,
              mediaStreams: result.probe?.streams ? JSON.stringify(result.probe.streams) : existing.mediaStreams,
              directPlayable: result.probe?.directPlayable ?? existing.directPlayable,
              needsTranscode: result.probe?.needsTranscode ?? existing.needsTranscode,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(movies.id, existing.id));

          // Scan subtitles and audio tracks
          if (result.probe?.streams) {
            await scanSubtitles(db, 'movie', existing.id, result.path, result.probe.streams);
            await saveAudioTracks(db, 'movie', existing.id, result.probe.streams);
          }

          stats.updated++;
        } else {
          // Insert new movie
          const movieId = generateId();
          await db.insert(movies).values({
            id: movieId,
            libraryId,
            filePath: result.path,
            title: title || 'Unknown',
            year,
            duration: result.probe?.duration,
            videoCodec: result.probe?.videoCodec,
            audioCodec: result.probe?.audioCodec,
            resolution: result.probe?.resolution,
            mediaStreams: result.probe?.streams ? JSON.stringify(result.probe.streams) : null,
            directPlayable: result.probe?.directPlayable,
            needsTranscode: result.probe?.needsTranscode,
            matchStatus: 'pending',
          });

          // Scan subtitles and audio tracks
          if (result.probe?.streams) {
            await scanSubtitles(db, 'movie', movieId, result.path, result.probe.streams);
            await saveAudioTracks(db, 'movie', movieId, result.probe.streams);
          }

          stats.added++;
        }
      } catch (error) {
        log.error({ error, path: result.path }, 'Failed to process movie');
        stats.errors++;
      }
    }
  } else {
    // TV show processing - group episodes by show
    const showMap = new Map<string, ScannerResult[]>();

    for (const result of results) {
      if (result.error || result.type !== 'episode') {
        if (result.error) stats.errors++;
        continue;
      }

      const parsed = result.parsed;
      const showTitle = isEpisodeParsed(parsed) ? parsed.showTitle : 'Unknown Show';
      const existing = showMap.get(showTitle) || [];
      existing.push(result);
      showMap.set(showTitle, existing);
    }

    const showEntries = Array.from(showMap.entries());
    for (let showIdx = 0; showIdx < showEntries.length; showIdx++) {
      const entry = showEntries[showIdx];
      if (!entry) continue;
      
      const [showTitle, showResults] = entry;

      // Update progress
      await job.updateProgress({
        percentage: 55 + Math.round((showIdx / showEntries.length) * 25), // 55-80%
        message: `Processing show: ${showTitle}`,
      });

      try {
        const firstResult = showResults[0];
        if (!firstResult) continue;

        // Determine show folder path (parent of first episode)
        const folderPath = dirname(dirname(firstResult.path));

        // Find or create show
        let show = await db.query.tvShows.findFirst({
          where: eq(tvShows.folderPath, folderPath),
        });

        let showId: string;
        if (!show) {
          showId = generateId();
          await db.insert(tvShows).values({
            id: showId,
            libraryId,
            folderPath,
            title: showTitle,
            matchStatus: 'pending',
          });
        } else {
          showId = show.id;
        }

        // Group episodes by season
        const seasonMap = new Map<number, ScannerResult[]>();
        for (const result of showResults) {
          const parsed = result.parsed;
          const seasonNum = isEpisodeParsed(parsed) ? parsed.seasonNumber : 1;
          const existing = seasonMap.get(seasonNum) || [];
          existing.push(result);
          seasonMap.set(seasonNum, existing);
        }

        // Process seasons and episodes
        for (const [seasonNum, seasonResults] of seasonMap) {
          // Find or create season
          let season = await db.query.seasons.findFirst({
            where: and(
              eq(seasons.showId, showId),
              eq(seasons.seasonNumber, seasonNum),
            ),
          });

          let seasonId: string;
          if (!season) {
            seasonId = generateId();
            await db.insert(seasons).values({
              id: seasonId,
              showId,
              seasonNumber: seasonNum,
              name: `Season ${seasonNum}`,
            });
          } else {
            seasonId = season.id;
          }

          // Process episodes
          for (const result of seasonResults) {
            const parsed = result.parsed;
            const episodeTitle = isEpisodeParsed(parsed) ? parsed.episodeTitle : undefined;
            const episodeNumber = isEpisodeParsed(parsed) ? parsed.episodeNumber : 1;

            const existing = await db.query.episodes.findFirst({
              where: eq(episodes.filePath, result.path),
            });

            if (existing) {
              await db.update(episodes)
                .set({
                  title: episodeTitle ?? existing.title,
                  duration: result.probe?.duration ?? existing.duration,
                  videoCodec: result.probe?.videoCodec ?? existing.videoCodec,
                  audioCodec: result.probe?.audioCodec ?? existing.audioCodec,
                  resolution: result.probe?.resolution ?? existing.resolution,
                  mediaStreams: result.probe?.streams ? JSON.stringify(result.probe.streams) : existing.mediaStreams,
                  directPlayable: result.probe?.directPlayable ?? existing.directPlayable,
                  needsTranscode: result.probe?.needsTranscode ?? existing.needsTranscode,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(episodes.id, existing.id));

              // Scan subtitles and audio tracks
              if (result.probe?.streams) {
                await scanSubtitles(db, 'episode', existing.id, result.path, result.probe.streams);
                await saveAudioTracks(db, 'episode', existing.id, result.probe.streams);
              }

              stats.updated++;
            } else {
              const episodeId = generateId();
              await db.insert(episodes).values({
                id: episodeId,
                showId,
                seasonId,
                filePath: result.path,
                seasonNumber: seasonNum,
                episodeNumber,
                title: episodeTitle,
                duration: result.probe?.duration,
                videoCodec: result.probe?.videoCodec,
                audioCodec: result.probe?.audioCodec,
                resolution: result.probe?.resolution,
                mediaStreams: result.probe?.streams ? JSON.stringify(result.probe.streams) : null,
                directPlayable: result.probe?.directPlayable,
                needsTranscode: result.probe?.needsTranscode,
              });

              // Scan subtitles and audio tracks
              if (result.probe?.streams) {
                await scanSubtitles(db, 'episode', episodeId, result.path, result.probe.streams);
                await saveAudioTracks(db, 'episode', episodeId, result.probe.streams);
              }

              stats.added++;
            }
          }

          // Update season episode count
          const episodeList = await db.query.episodes.findMany({
            where: eq(episodes.seasonId, seasonId),
          });
          await db.update(seasons)
            .set({ episodeCount: episodeList.length })
            .where(eq(seasons.id, seasonId));
        }

        // Update show counts
        const allSeasons = await db.query.seasons.findMany({
          where: eq(seasons.showId, showId),
        });
        const allEpisodes = await db.query.episodes.findMany({
          where: eq(episodes.showId, showId),
        });
        await db.update(tvShows)
          .set({
            seasonCount: allSeasons.length,
            episodeCount: allEpisodes.length,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tvShows.id, showId));
      } catch (error) {
        log.error({ error, showTitle }, 'Failed to process TV show');
        stats.errors++;
      }
    }
  }

  return stats;
}
