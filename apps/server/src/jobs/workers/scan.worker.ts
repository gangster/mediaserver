/**
 * Library scan worker.
 *
 * Processes library scan jobs using BullMQ.
 */

import type { Job } from 'bullmq';
import type { Database } from '@mediaserver/db';
import { libraries, eq } from '@mediaserver/db';
import { scanLibrary as runScanner } from '@mediaserver/scanner';
import type { ScanProgress } from '@mediaserver/scanner';
import { createLogger } from '../../lib/logger.js';
import type { ScanJobData, ScanResult, ScanLibraryJobData } from '../types.js';
import { fetchPendingMovieMetadata, fetchPendingShowMetadata } from '../../services/metadata.js';

const log = createLogger('info');

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
        percentage: Math.round(progress.progress * 0.7) + 5, // 5-75%
        message: progress.currentFile
          ? `Scanning: ${progress.currentFile}`
          : `${progress.status} (${progress.itemsScanned}/${progress.itemsTotal})`,
      });
    }
  );

  await job.updateProgress({
    percentage: 75,
    message: 'Processing results...',
  });

  // Count results
  let added = 0;
  let updated = 0;
  let errors = 0;

  for (const result of results) {
    if (result.error) {
      errors++;
    } else {
      // In a real implementation, you'd process and save to DB here
      // For now, we count them
      added++;
    }
  }

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
    message: `Complete: ${added} added, ${updated} updated, ${errors} errors`,
  });

  log.info(
    { jobId: job.id, libraryId, libraryName, added, updated, errors },
    'Library scan completed'
  );

  return { added, updated, removed: 0, errors };
}
