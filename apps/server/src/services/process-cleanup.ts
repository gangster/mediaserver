/**
 * Process Cleanup Utilities
 *
 * Handles cleanup of orphaned FFmpeg processes and stale transcode directories.
 * This is critical for reliability - when the server restarts, we need to ensure
 * no orphaned processes are left running that could conflict with new sessions.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '../lib/logger.js';

const execAsync = promisify(exec);

/** Default transcode directory */
const DEFAULT_TRANSCODE_DIR = '/tmp/mediaserver/transcode';

/**
 * Kill all FFmpeg processes that are writing to our transcode directory.
 * This ensures no orphaned processes from previous server instances.
 */
export async function killOrphanedFFmpegProcesses(
  transcodeDir: string = DEFAULT_TRANSCODE_DIR
): Promise<number> {
  let killed = 0;

  try {
    // Find all FFmpeg processes writing to our transcode directory
    // Using pgrep with -f to match the full command line
    const { stdout } = await execAsync(
      `pgrep -f "ffmpeg.*${transcodeDir}" 2>/dev/null || true`
    );

    const pids = stdout
      .trim()
      .split('\n')
      .filter((pid) => pid.length > 0)
      .map((pid) => parseInt(pid, 10))
      .filter((pid) => !isNaN(pid));

    if (pids.length === 0) {
      logger.debug('No orphaned FFmpeg processes found');
      return 0;
    }

    logger.info({ pids }, 'Found orphaned FFmpeg processes, killing them');

    // Kill each process
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGKILL');
        killed++;
        logger.debug({ pid }, 'Killed orphaned FFmpeg process');
      } catch (error) {
        // Process might have already exited
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
          logger.warn({ pid, error }, 'Failed to kill FFmpeg process');
        }
      }
    }

    logger.info({ killed }, 'Killed orphaned FFmpeg processes');
  } catch (error) {
    logger.error({ error }, 'Error killing orphaned FFmpeg processes');
  }

  return killed;
}

/**
 * Clean up stale transcode directories.
 * Removes all session directories that are older than maxAge.
 */
export async function cleanupStaleTranscodeDirectories(
  transcodeDir: string = DEFAULT_TRANSCODE_DIR,
  maxAgeMs: number = 0 // 0 means remove all
): Promise<number> {
  let cleaned = 0;

  try {
    // Check if directory exists
    try {
      await stat(transcodeDir);
    } catch {
      logger.debug({ transcodeDir }, 'Transcode directory does not exist, nothing to clean');
      return 0;
    }

    const entries = await readdir(transcodeDir, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const sessionDir = join(transcodeDir, entry.name);

      try {
        // Check directory age if maxAge is specified
        if (maxAgeMs > 0) {
          const stats = await stat(sessionDir);
          const age = now - stats.mtimeMs;
          if (age < maxAgeMs) {
            continue; // Directory is still fresh
          }
        }

        // Remove the directory
        await rm(sessionDir, { recursive: true, force: true });
        cleaned++;
        logger.debug({ sessionDir }, 'Removed stale transcode directory');
      } catch (error) {
        logger.warn({ sessionDir, error }, 'Failed to remove stale directory');
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned }, 'Cleaned up stale transcode directories');
    }
  } catch (error) {
    logger.error({ error }, 'Error cleaning up transcode directories');
  }

  return cleaned;
}

/**
 * Write FFmpeg PID to session directory for tracking.
 */
export async function writePidFile(
  sessionDir: string,
  pid: number
): Promise<void> {
  const pidFile = join(sessionDir, 'ffmpeg.pid');
  await writeFile(pidFile, pid.toString(), 'utf-8');
}

/**
 * Read FFmpeg PID from session directory.
 */
export async function readPidFile(sessionDir: string): Promise<number | null> {
  const pidFile = join(sessionDir, 'ffmpeg.pid');
  try {
    const content = await readFile(pidFile, 'utf-8');
    const pid = parseInt(content.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Kill FFmpeg process by reading PID from session directory.
 */
export async function killSessionFFmpeg(sessionDir: string): Promise<boolean> {
  const pid = await readPidFile(sessionDir);
  if (pid === null) {
    return false;
  }

  try {
    process.kill(pid, 'SIGKILL');
    logger.debug({ pid, sessionDir }, 'Killed FFmpeg process from PID file');
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      logger.warn({ pid, sessionDir, error }, 'Failed to kill FFmpeg from PID file');
    }
    return false;
  }
}

/**
 * Full startup cleanup - kills orphaned processes and removes stale directories.
 * Call this when the streaming service initializes.
 */
export async function performStartupCleanup(
  transcodeDir: string = DEFAULT_TRANSCODE_DIR
): Promise<{ processesKilled: number; directoriesCleaned: number }> {
  logger.info({ transcodeDir }, 'Performing startup cleanup');

  // First kill orphaned FFmpeg processes
  const processesKilled = await killOrphanedFFmpegProcesses(transcodeDir);

  // Wait a moment for processes to fully terminate
  if (processesKilled > 0) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Then clean up stale directories
  const directoriesCleaned = await cleanupStaleTranscodeDirectories(
    transcodeDir,
    0 // Remove all on startup
  );

  logger.info(
    { processesKilled, directoriesCleaned },
    'Startup cleanup complete'
  );

  return { processesKilled, directoriesCleaned };
}
