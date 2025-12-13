/**
 * Image proxy routes.
 *
 * Proxies and caches images from external sources (TMDB CDN).
 * Supports different sizes and local caching.
 */

import { Hono } from 'hono';
import { mkdir, access, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createDatabaseFromEnv, movies, tvShows, episodes, eq, type Database } from '@mediaserver/db';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// Default cache directory
const CACHE_DIR = process.env['METADATA_CACHE_DIR'] ?? './data/images';

// Cached database instance
let db: Database | null = null;
function getDb(): Database {
  if (!db) {
    db = createDatabaseFromEnv();
  }
  return db;
}

/**
 * Size mappings for different image types
 */
const SIZE_MAP: Record<string, Record<string, string>> = {
  poster: {
    small: 'w185',
    medium: 'w342',
    large: 'w500',
    original: 'original',
  },
  backdrop: {
    small: 'w300',
    medium: 'w780',
    large: 'w1280',
    original: 'original',
  },
  still: {
    small: 'w185',
    medium: 'w300',
    large: 'w500',
    original: 'original',
  },
  profile: {
    small: 'w45',
    medium: 'w185',
    large: 'w632',
    original: 'original',
  },
  logo: {
    small: 'w92',
    medium: 'w185',
    large: 'w500',
    original: 'original',
  },
};

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
 * Get content type from file extension
 */
function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Download and cache an image from TMDB
 */
async function downloadAndCache(
  tmdbPath: string,
  size: string,
  localPath: string
): Promise<Buffer> {
  const url = `${TMDB_IMAGE_BASE}/${size}${tmdbPath}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  // Ensure directory exists
  await mkdir(dirname(localPath), { recursive: true });

  // Get image data
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Write to cache
  await writeFile(localPath, buffer);

  return buffer;
}

export const imagesRouter = new Hono();

/**
 * Get image by type and path
 *
 * URL format: /api/images/:imageType/:tmdbPath
 * Query params:
 *   - size: small | medium | large | original (default: medium)
 *
 * Example: /api/images/poster/abc123.jpg?size=large
 */
imagesRouter.get('/:imageType/:tmdbPath', async (c) => {
  const imageType = c.req.param('imageType');
  const tmdbPath = '/' + c.req.param('tmdbPath');
  const size = c.req.query('size') ?? 'medium';

  // Validate image type
  if (!SIZE_MAP[imageType]) {
    return c.json({ error: 'Invalid image type' }, 400);
  }

  // Get TMDB size code
  const tmdbSize = SIZE_MAP[imageType]?.[size] ?? SIZE_MAP[imageType]?.['medium'];
  if (!tmdbSize) {
    return c.json({ error: 'Invalid size' }, 400);
  }

  // Generate cache path
  const cachePath = join(CACHE_DIR, imageType, tmdbSize, tmdbPath.replace(/^\//, ''));

  try {
    let imageData: Buffer;
    let cacheHit = false;

    // Check if cached
    if (await fileExists(cachePath)) {
      imageData = await readFile(cachePath);
      cacheHit = true;
    } else {
      // Download and cache
      imageData = await downloadAndCache(tmdbPath, tmdbSize, cachePath);
    }

    // Return the image
    return new Response(new Uint8Array(imageData), {
      status: 200,
      headers: {
        'Content-Type': getContentType(cachePath),
        'Content-Length': String(imageData.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Cache': cacheHit ? 'HIT' : 'MISS',
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch image' },
      500
    );
  }
});

/**
 * Get media-specific image (for movies, shows, etc.)
 *
 * URL format: /api/images/:mediaType/:mediaId/:imageType
 * Query params:
 *   - size: small | medium | large | original (default: medium)
 *
 * Example: /api/images/movies/abc123/poster?size=large
 *
 * This route requires the media item to have poster_path/backdrop_path in DB.
 * For direct TMDB paths, use the route above.
 */
imagesRouter.get('/:mediaType/:mediaId/:imageType', async (c) => {
  const mediaType = c.req.param('mediaType');
  const mediaId = c.req.param('mediaId');
  const imageType = c.req.param('imageType');
  const size = c.req.query('size') ?? 'medium';

  // Validate image type
  if (!SIZE_MAP[imageType]) {
    return c.json({ error: 'Invalid image type' }, 400);
  }

  // Get database connection
  const database = getDb();

  let tmdbPath: string | null = null;

  try {
    // Look up the media item
    if (mediaType === 'movies') {
      const movie = await database.query.movies.findFirst({
        where: eq(movies.id, mediaId),
        columns: { posterPath: true, backdropPath: true },
      });
      if (movie) {
        tmdbPath = imageType === 'poster' ? movie.posterPath : movie.backdropPath;
      }
    } else if (mediaType === 'shows') {
      const show = await database.query.tvShows.findFirst({
        where: eq(tvShows.id, mediaId),
        columns: { posterPath: true, backdropPath: true },
      });
      if (show) {
        tmdbPath = imageType === 'poster' ? show.posterPath : show.backdropPath;
      }
    } else if (mediaType === 'episodes') {
      const episode = await database.query.episodes.findFirst({
        where: eq(episodes.id, mediaId),
        columns: { stillPath: true },
      });
      if (episode) {
        // Episodes only have still images
        tmdbPath = episode.stillPath;
      }
    } else {
      return c.json({ error: 'Invalid media type' }, 400);
    }

    if (!tmdbPath) {
      return c.json({ error: 'Image not found for this media item' }, 404);
    }

    // Get TMDB size code
    const tmdbSize = SIZE_MAP[imageType]?.[size] ?? SIZE_MAP[imageType]?.['medium'];
    if (!tmdbSize) {
      return c.json({ error: 'Invalid size' }, 400);
    }

    // Generate cache path
    const cachePath = join(CACHE_DIR, imageType, tmdbSize, tmdbPath.replace(/^\//, ''));

    let imageData: Buffer;
    let cacheHit = false;

    // Check if cached
    if (await fileExists(cachePath)) {
      imageData = await readFile(cachePath);
      cacheHit = true;
    } else {
      // Download and cache
      imageData = await downloadAndCache(tmdbPath, tmdbSize, cachePath);
    }

    // Return the image
    return new Response(new Uint8Array(imageData), {
      status: 200,
      headers: {
        'Content-Type': getContentType(cachePath),
        'Content-Length': String(imageData.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Cache': cacheHit ? 'HIT' : 'MISS',
      },
    });
  } catch (error) {
    console.error('Error serving media image:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch image' },
      500
    );
  }
});

