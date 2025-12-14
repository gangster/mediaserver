/**
 * Trickplay routes - thumbnail sprite generation for seek previews.
 *
 * Generates and serves thumbnail sprite sheets for the video player's
 * seek preview functionality. Sprites are cached on disk for performance.
 */

import { Hono } from 'hono';
import { mkdir, access, readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import {
  createDatabaseFromEnv,
  movies,
  episodes,
  eq,
  type Database,
} from '@mediaserver/db';
import type { TrickplayData } from '@mediaserver/core';

// Trickplay configuration
const TRICKPLAY_CONFIG = {
  /** Seconds between thumbnails */
  interval: 10,
  /** Width of each thumbnail */
  thumbnailWidth: 160,
  /** Height of each thumbnail (16:9 aspect ratio) */
  thumbnailHeight: 90,
  /** Columns in sprite sheet */
  columns: 10,
  /** Rows in sprite sheet */
  rows: 10,
};

// Cache directory
const TRICKPLAY_CACHE_DIR = process.env['TRICKPLAY_CACHE_DIR'] ?? './data/trickplay';

// Cached database instance
let db: Database | null = null;
function getDb(): Database {
  if (!db) {
    db = createDatabaseFromEnv();
  }
  return db;
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the file path for a media item
 */
async function getMediaFilePath(
  mediaType: 'movie' | 'episode',
  mediaId: string
): Promise<{ filePath: string; duration: number } | null> {
  const database = getDb();

  if (mediaType === 'movie') {
    const movie = await database.query.movies.findFirst({
      where: eq(movies.id, mediaId),
      columns: { filePath: true, duration: true },
    });
    if (movie) {
      return { filePath: movie.filePath, duration: movie.duration ?? 0 };
    }
  } else {
    const episode = await database.query.episodes.findFirst({
      where: eq(episodes.id, mediaId),
      columns: { filePath: true, duration: true },
    });
    if (episode) {
      return { filePath: episode.filePath, duration: episode.duration ?? 0 };
    }
  }

  return null;
}

/**
 * Generate a trickplay sprite sheet using FFmpeg.
 */
async function generateSprite(
  inputPath: string,
  outputPath: string,
  duration: number
): Promise<void> {
  // Ensure output directory exists
  await mkdir(dirname(outputPath), { recursive: true });

  const { interval, thumbnailWidth, thumbnailHeight, columns, rows } = TRICKPLAY_CONFIG;

  // Calculate the total number of thumbnails we can fit
  const maxThumbnails = columns * rows;
  const totalThumbnails = Math.min(Math.ceil(duration / interval), maxThumbnails);

  // FFmpeg filter to extract frames and create sprite sheet
  // fps=1/interval: Extract one frame every `interval` seconds
  // scale=width:height: Scale to thumbnail size
  // tile=columns x rows: Arrange into grid
  const filterComplex = `fps=1/${interval},scale=${thumbnailWidth}:${thumbnailHeight},tile=${columns}x${Math.ceil(totalThumbnails / columns)}`;

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i',
      inputPath,
      '-vf',
      filterComplex,
      '-frames:v',
      '1', // Only one output frame (the sprite sheet)
      '-q:v',
      '5', // Quality (lower = better, 2-31 scale)
      '-y', // Overwrite output
      outputPath,
    ]);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
    });
  });
}

/**
 * Get trickplay metadata for a media item.
 */
function getTrickplayMetadata(duration: number): TrickplayData {
  const { interval, thumbnailWidth, thumbnailHeight, columns, rows } = TRICKPLAY_CONFIG;
  const maxThumbnails = columns * rows;
  const totalThumbnails = Math.min(Math.ceil(duration / interval), maxThumbnails);

  return {
    spriteUrl: `sprite.jpg`,
    interval,
    thumbnailWidth,
    thumbnailHeight,
    columns,
    rows: Math.ceil(totalThumbnails / columns),
    totalThumbnails,
  };
}

export const trickplayRouter = new Hono();

/**
 * Get trickplay metadata for a media item.
 *
 * GET /api/trickplay/:mediaType/:mediaId/metadata.json
 */
trickplayRouter.get('/:mediaType/:mediaId/metadata.json', async (c) => {
  const mediaType = c.req.param('mediaType') as 'movie' | 'episode';
  const mediaId = c.req.param('mediaId');

  // Validate media type
  if (mediaType !== 'movie' && mediaType !== 'episode') {
    return c.json({ error: 'Invalid media type' }, 400);
  }

  try {
    // Get media file info
    const mediaInfo = await getMediaFilePath(mediaType, mediaId);
    if (!mediaInfo) {
      return c.json({ error: 'Media not found' }, 404);
    }

    // Return metadata
    const metadata = getTrickplayMetadata(mediaInfo.duration);
    return c.json(metadata);
  } catch (error) {
    console.error('Error getting trickplay metadata:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get metadata' },
      500
    );
  }
});

/**
 * Get trickplay sprite sheet for a media item.
 *
 * GET /api/trickplay/:mediaType/:mediaId/sprite.jpg
 *
 * Generates the sprite on first request and caches it.
 */
trickplayRouter.get('/:mediaType/:mediaId/sprite.jpg', async (c) => {
  const mediaType = c.req.param('mediaType') as 'movie' | 'episode';
  const mediaId = c.req.param('mediaId');

  // Validate media type
  if (mediaType !== 'movie' && mediaType !== 'episode') {
    return c.json({ error: 'Invalid media type' }, 400);
  }

  try {
    // Get media file info
    const mediaInfo = await getMediaFilePath(mediaType, mediaId);
    if (!mediaInfo) {
      return c.json({ error: 'Media not found' }, 404);
    }

    // Check if input file exists
    if (!(await fileExists(mediaInfo.filePath))) {
      return c.json({ error: 'Media file not found on disk' }, 404);
    }

    // Cache path for sprite
    const spritePath = join(TRICKPLAY_CACHE_DIR, mediaType, mediaId, 'sprite.jpg');

    // Check if sprite is already cached
    if (!(await fileExists(spritePath))) {
      // Generate sprite
      console.log(`Generating trickplay sprite for ${mediaType}/${mediaId}...`);
      await generateSprite(mediaInfo.filePath, spritePath, mediaInfo.duration);
      console.log(`Trickplay sprite generated: ${spritePath}`);
    }

    // Read and return sprite
    const spriteData = await readFile(spritePath);
    const stats = await stat(spritePath);

    return new Response(new Uint8Array(spriteData), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(stats.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving trickplay sprite:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to generate sprite' },
      500
    );
  }
});

/**
 * Regenerate trickplay sprite (admin only, useful if media was re-encoded).
 *
 * POST /api/trickplay/:mediaType/:mediaId/regenerate
 */
trickplayRouter.post('/:mediaType/:mediaId/regenerate', async (c) => {
  const mediaType = c.req.param('mediaType') as 'movie' | 'episode';
  const mediaId = c.req.param('mediaId');

  // TODO: Add authentication check for admin

  // Validate media type
  if (mediaType !== 'movie' && mediaType !== 'episode') {
    return c.json({ error: 'Invalid media type' }, 400);
  }

  try {
    // Get media file info
    const mediaInfo = await getMediaFilePath(mediaType, mediaId);
    if (!mediaInfo) {
      return c.json({ error: 'Media not found' }, 404);
    }

    // Check if input file exists
    if (!(await fileExists(mediaInfo.filePath))) {
      return c.json({ error: 'Media file not found on disk' }, 404);
    }

    // Cache path for sprite
    const spritePath = join(TRICKPLAY_CACHE_DIR, mediaType, mediaId, 'sprite.jpg');

    // Generate sprite (overwrite existing)
    console.log(`Regenerating trickplay sprite for ${mediaType}/${mediaId}...`);
    await generateSprite(mediaInfo.filePath, spritePath, mediaInfo.duration);
    console.log(`Trickplay sprite regenerated: ${spritePath}`);

    return c.json({ success: true, path: spritePath });
  } catch (error) {
    console.error('Error regenerating trickplay sprite:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate sprite' },
      500
    );
  }
});
