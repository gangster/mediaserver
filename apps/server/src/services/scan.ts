/**
 * Library Scan Service
 *
 * Runs the library scanner and saves results to the database.
 */

import { eq, and, type Database, backgroundJobs, movies, tvShows, seasons, episodes, libraries } from '@mediaserver/db';
import { scanLibrary } from '@mediaserver/scanner';
import type { ScanProgress, ScanResult, ParsedMovie, ParsedEpisode } from '@mediaserver/scanner';
import { logger } from '../lib/logger.js';
import { dirname } from 'node:path';
import { fetchPendingMovieMetadata, fetchPendingShowMetadata } from './metadata.js';

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
 * Runs a library scan job.
 */
export async function runLibraryScan(db: Database, jobId: string, libraryId: string): Promise<void> {
  const log = logger.child({ jobId, libraryId });
  log.info('Starting library scan');

  try {
    // Get library info
    const library = await db.query.libraries.findFirst({
      where: eq(libraries.id, libraryId),
    });

    if (!library) {
      throw new Error(`Library not found: ${libraryId}`);
    }

    // Parse paths
    const paths: string[] = typeof library.paths === 'string'
      ? JSON.parse(library.paths)
      : library.paths;

    // Update job status to active
    await db.update(backgroundJobs)
      .set({
        status: 'active',
        startedAt: new Date().toISOString(),
      })
      .where(eq(backgroundJobs.id, jobId));

    let lastProgress = 0;

    // Run scanner with progress updates
    const results = await scanLibrary(
      libraryId,
      paths,
      library.type as 'movie' | 'tv',
      async (progress: ScanProgress) => {
        // Throttle DB updates to every 5%
        if (progress.progress - lastProgress >= 5 || progress.status === 'complete') {
          lastProgress = progress.progress;
          await db.update(backgroundJobs)
            .set({
              progress: progress.progress,
              progressMessage: progress.currentFile
                ? `Scanning: ${progress.currentFile}`
                : `${progress.status} (${progress.itemsScanned}/${progress.itemsTotal})`,
            })
            .where(eq(backgroundJobs.id, jobId));
        }
      },
    );

    log.info({ resultCount: results.length }, 'Scan completed, processing results');

    // Process results and save to database
    const stats = await processResults(db, libraryId, library.type as 'movie' | 'tv', results);

    // Update library last scanned time
    await db.update(libraries)
      .set({ lastScannedAt: new Date().toISOString() })
      .where(eq(libraries.id, libraryId));

    // Trigger metadata fetching for new items
    log.info('Starting metadata fetch for pending items');
    await db.update(backgroundJobs)
      .set({
        progressMessage: 'Fetching metadata...',
      })
      .where(eq(backgroundJobs.id, jobId));

    let metadataStats: { matched: number; unmatched: number; errors: number };
    try {
      if (library.type === 'movie') {
        metadataStats = await fetchPendingMovieMetadata(db, libraryId);
      } else {
        metadataStats = await fetchPendingShowMetadata(db, libraryId);
      }
      log.info(metadataStats, 'Metadata fetch completed');
    } catch (error) {
      log.error({ error }, 'Metadata fetch failed');
      metadataStats = { matched: 0, unmatched: 0, errors: 1 };
    }

    // Mark job as completed
    await db.update(backgroundJobs)
      .set({
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString(),
        result: JSON.stringify({
          ...stats,
          metadata: metadataStats,
        }),
        progressMessage: `Added ${stats.added}, matched ${metadataStats.matched}`,
      })
      .where(eq(backgroundJobs.id, jobId));

    log.info({ ...stats, metadata: metadataStats }, 'Library scan completed');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error({ error: message }, 'Library scan failed');

    await db.update(backgroundJobs)
      .set({
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: message,
      })
      .where(eq(backgroundJobs.id, jobId));
  }
}

interface ScanStats {
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
  results: ScanResult[],
): Promise<ScanStats> {
  const stats: ScanStats = { added: 0, updated: 0, errors: 0 };

  if (type === 'movie') {
    for (const result of results) {
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
              updatedAt: new Date().toISOString(),
            })
            .where(eq(movies.id, existing.id));
          stats.updated++;
        } else {
          // Insert new movie
          await db.insert(movies).values({
            id: generateId(),
            libraryId,
            filePath: result.path,
            title: title || 'Unknown',
            year,
            duration: result.probe?.duration,
            videoCodec: result.probe?.videoCodec,
            audioCodec: result.probe?.audioCodec,
            resolution: result.probe?.resolution,
            matchStatus: 'pending',
          });
          stats.added++;
        }
      } catch (error) {
        logger.error({ error, path: result.path }, 'Failed to process movie');
        stats.errors++;
      }
    }
  } else {
    // TV show processing - group episodes by show
    const showMap = new Map<string, ScanResult[]>();

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

    for (const [showTitle, showResults] of showMap) {
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
        const seasonMap = new Map<number, ScanResult[]>();
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
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(episodes.id, existing.id));
              stats.updated++;
            } else {
              await db.insert(episodes).values({
                id: generateId(),
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
              });
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
        logger.error({ error, showTitle }, 'Failed to process TV show');
        stats.errors++;
      }
    }
  }

  return stats;
}
