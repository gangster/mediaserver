/**
 * Metadata Service
 *
 * Fetches metadata from external sources (TMDB, etc.) for movies and TV shows.
 */

import {
  eq,
  and,
  type Database,
  movies,
  tvShows,
  genres,
  movieGenres,
  showGenres,
  people,
  movieCredits,
  contentRatings,
  trailers,
  externalIds,
  mediaRatings,
} from '@mediaserver/db';
import {
  MetadataManager,
  TmdbIntegration,
  MdblistIntegration,
  TvdbIntegration,
  TraktIntegration,
  createDefaultMetadataSettings,
  type MovieDetails,
  type ShowDetails,
  type MetadataSettings,
  type MetadataIntegration,
} from '@mediaserver/metadata';
import { logger } from '../lib/logger.js';
import { nanoid } from 'nanoid';

/** Generate a unique ID */
function generateId(): string {
  return nanoid();
}

/** Default metadata manager instance */
let metadataManager: MetadataManager | null = null;

/**
 * Initialize the metadata manager with integrations
 * Loads configuration from database if db is provided
 */
export async function initializeMetadataManager(
  settings?: Partial<MetadataSettings>,
  tmdbApiKey?: string,
  db?: Database
): Promise<MetadataManager> {
  const defaultSettings = createDefaultMetadataSettings();
  
  // Load provider configs from database if available
  let dbConfigs: Map<string, { enabled: boolean; apiKey?: string; config?: Record<string, unknown> }> = new Map();
  if (db) {
    try {
      const configs = await db.query.providerConfigs.findMany();
      for (const config of configs) {
        dbConfigs.set(config.providerId, {
          enabled: config.enabled ?? false,
          apiKey: config.apiKey ?? undefined,
          config: config.config ? JSON.parse(config.config) : undefined,
        });
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to load provider configs from database');
    }
  }

  // Helper to get config for a provider
  const getProviderConfig = (id: string, defaults: { enabled: boolean; apiKey?: string }) => {
    const dbConfig = dbConfigs.get(id);
    return {
      id,
      name: id.toUpperCase(),
      enabled: dbConfig?.enabled ?? defaults.enabled,
      apiKey: dbConfig?.apiKey ?? defaults.apiKey,
      options: dbConfig?.config,
    };
  };

  const mergedSettings: MetadataSettings = {
    ...defaultSettings,
    ...settings,
    integrations: {
      ...defaultSettings.integrations,
      tmdb: getProviderConfig('tmdb', { enabled: !!tmdbApiKey, apiKey: tmdbApiKey }),
      mdblist: getProviderConfig('mdblist', { enabled: false }),
      tvdb: getProviderConfig('tvdb', { enabled: false }),
      trakt: getProviderConfig('trakt', { enabled: false }),
    },
  };

  const manager = new MetadataManager(mergedSettings);

  // Register all integrations
  manager.registerIntegration(new TmdbIntegration());
  manager.registerIntegration(new MdblistIntegration());
  manager.registerIntegration(new TvdbIntegration());
  manager.registerIntegration(new TraktIntegration());

  // Initialize all
  await manager.initializeAll();

  metadataManager = manager;
  return manager;
}

/**
 * Get the metadata manager instance
 */
export function getMetadataManager(): MetadataManager {
  if (!metadataManager) {
    throw new Error('Metadata manager not initialized');
  }
  return metadataManager;
}

/**
 * MetadataResult returned by job workers
 */
export interface MetadataFetchResult {
  matched: boolean;
  title?: string;
  year?: number;
  provider?: string;
  externalId?: string;
  error?: string;
}

/**
 * Fetch metadata for a single movie
 */
export async function fetchMovieMetadata(
  db: Database,
  movieId: string,
  title?: string,
  year?: number
): Promise<MetadataFetchResult> {
  const log = logger.child({ movieId });
  log.info('Fetching movie metadata');

  const manager = getMetadataManager();

  // Get movie from database
  const movie = await db.query.movies.findFirst({
    where: eq(movies.id, movieId),
  });

  if (!movie) {
    return { matched: false };
  }

  // Use provided title/year or fall back to database values
  const searchTitle = title ?? movie.title;
  const searchYear = year ?? movie.year ?? undefined;

  // Skip if already matched and not forcing refresh
  if (movie.matchStatus === 'matched') {
    log.info('Movie already matched, skipping');
    return { 
      matched: true, 
      title: movie.title, 
      year: movie.year ?? undefined,
      provider: 'tmdb',
      externalId: movie.tmdbId ? String(movie.tmdbId) : undefined,
    };
  }

  try {
    // Fetch complete metadata
    const { details, ratings, result } = await manager.fetchCompleteMovieMetadata(
      searchTitle,
      searchYear
    );

    if (!result.matched || !details) {
      // Mark as unmatched
      await db.update(movies)
        .set({ matchStatus: 'unmatched' })
        .where(eq(movies.id, movieId));

      log.info('No metadata match found');
      return { matched: false };
    }

    // Save metadata to database
    await saveMovieMetadata(db, movieId, details);

    // Save ratings if available
    if (ratings) {
      await saveMovieRatings(db, movieId, ratings);
    }

    // Update movie status
    await db.update(movies)
      .set({
        matchStatus: 'matched',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(movies.id, movieId));

    // Extract year from release date
    const releaseYear = details.releaseDate
      ? new Date(details.releaseDate).getFullYear()
      : undefined;

    log.info({ confidence: result.confidence }, 'Movie metadata fetched successfully');
    return {
      matched: true,
      title: details.title,
      year: releaseYear,
      provider: 'tmdb',
      externalId: String(details.externalIds.tmdb),
    };
  } catch (error) {
    log.error({ error }, 'Failed to fetch movie metadata');
    return { matched: false };
  }
}

/**
 * Save movie metadata to database
 */
async function saveMovieMetadata(
  db: Database,
  movieId: string,
  details: MovieDetails
): Promise<void> {
  // Update movie record
  await db.update(movies)
    .set({
      tmdbId: details.externalIds.tmdb,
      imdbId: details.externalIds.imdb,
      title: details.title,
      overview: details.overview,
      tagline: details.tagline,
      releaseDate: details.releaseDate,
      runtime: details.runtime,
      voteAverage: details.voteAverage,
      voteCount: details.voteCount,
      posterPath: details.posterPath,
      backdropPath: details.backdropPath,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(movies.id, movieId));

  // Save genres
  if (details.genres.length > 0) {
    await saveMovieGenres(db, movieId, details.genres);
  }

  // Save cast/crew
  if (details.cast.length > 0 || details.crew.length > 0) {
    await saveMovieCredits(db, movieId, details.cast, details.crew);
  }

  // Save content ratings
  if (details.contentRatings.length > 0) {
    await saveContentRatings(db, 'movie', movieId, details.contentRatings);
  }

  // Save trailers
  if (details.trailers.length > 0) {
    await saveTrailers(db, 'movie', movieId, details.trailers);
  }

  // Save external IDs
  await saveExternalIds(db, 'movie', movieId, details.externalIds);
}

/**
 * Save movie genres
 */
async function saveMovieGenres(
  db: Database,
  movieId: string,
  genreList: MovieDetails['genres']
): Promise<void> {
  // Delete existing genre associations
  await db.delete(movieGenres).where(eq(movieGenres.movieId, movieId));

  for (const genre of genreList) {
    // Find or create genre
    let dbGenre = await db.query.genres.findFirst({
      where: eq(genres.tmdbId, genre.id),
    });

    if (!dbGenre) {
      const genreId = generateId();
      await db.insert(genres).values({
        id: genreId,
        tmdbId: genre.id,
        name: genre.name,
      }).onConflictDoNothing();

      dbGenre = { id: genreId, tmdbId: genre.id, name: genre.name };
    }

    // Create association
    await db.insert(movieGenres).values({
      movieId,
      genreId: dbGenre.id,
    }).onConflictDoNothing();
  }
}

/**
 * Save movie cast and crew
 */
async function saveMovieCredits(
  db: Database,
  movieId: string,
  cast: MovieDetails['cast'],
  crew: MovieDetails['crew']
): Promise<void> {
  // Delete existing credits
  await db.delete(movieCredits).where(eq(movieCredits.movieId, movieId));

  // Save cast
  for (const member of cast) {
    const personId = await findOrCreatePerson(db, member);

    await db.insert(movieCredits).values({
      id: generateId(),
      movieId,
      personId,
      roleType: 'cast',
      character: member.character,
      creditOrder: member.order,
    });
  }

  // Save crew
  for (const member of crew) {
    const personId = await findOrCreatePerson(db, member);

    await db.insert(movieCredits).values({
      id: generateId(),
      movieId,
      personId,
      roleType: 'crew',
      department: member.department,
      job: member.job,
    });
  }
}

/**
 * Find or create a person record
 */
async function findOrCreatePerson(
  db: Database,
  person: { id: string; name: string; profilePath?: string }
): Promise<string> {
  const tmdbId = parseInt(person.id, 10);

  // Try to find by TMDB ID
  const existing = await db.query.people.findFirst({
    where: eq(people.tmdbId, tmdbId),
  });

  if (existing) {
    return existing.id;
  }

  // Create new person
  const personId = generateId();
  await db.insert(people).values({
    id: personId,
    tmdbId,
    name: person.name,
    profilePath: person.profilePath,
  });

  return personId;
}

/**
 * Save content ratings
 */
async function saveContentRatings(
  db: Database,
  mediaType: 'movie' | 'tvshow',
  mediaId: string,
  ratings: MovieDetails['contentRatings']
): Promise<void> {
  // Delete existing ratings for this media
  await db.delete(contentRatings)
    .where(and(
      eq(contentRatings.mediaType, mediaType),
      eq(contentRatings.mediaId, mediaId)
    ));

  for (const rating of ratings) {
    await db.insert(contentRatings).values({
      mediaType,
      mediaId,
      country: rating.country,
      rating: rating.rating,
    }).onConflictDoNothing();
  }
}

/**
 * Save trailers
 */
async function saveTrailers(
  db: Database,
  mediaType: 'movie' | 'tvshow',
  mediaId: string,
  trailerList: MovieDetails['trailers']
): Promise<void> {
  // Delete existing trailers for this media
  await db.delete(trailers)
    .where(and(
      eq(trailers.mediaType, mediaType),
      eq(trailers.mediaId, mediaId)
    ));

  for (const trailer of trailerList) {
    await db.insert(trailers).values({
      id: generateId(),
      mediaType,
      mediaId,
      name: trailer.name,
      site: trailer.site,
      videoKey: trailer.key,
      type: trailer.type,
      official: trailer.official,
      publishedAt: trailer.publishedAt,
    });
  }
}

/**
 * Save external IDs
 */
async function saveExternalIds(
  db: Database,
  mediaType: 'movie' | 'show',
  mediaId: string,
  ids: MovieDetails['externalIds']
): Promise<void> {
  const idMap: Record<string, string | number | undefined> = {
    tmdb: ids.tmdb,
    imdb: ids.imdb,
    tvdb: ids.tvdb,
  };

  for (const [provider, externalId] of Object.entries(idMap)) {
    if (externalId !== undefined) {
      await db.insert(externalIds).values({
        mediaType,
        mediaId,
        provider: provider as 'tmdb' | 'imdb' | 'tvdb',
        externalId: String(externalId),
      }).onConflictDoUpdate({
        target: [externalIds.mediaType, externalIds.mediaId, externalIds.provider],
        set: {
          externalId: String(externalId),
          updatedAt: new Date().toISOString(),
        },
      });
    }
  }
}

/**
 * Save movie ratings from aggregator
 */
async function saveMovieRatings(
  db: Database,
  movieId: string,
  ratings: NonNullable<Awaited<ReturnType<MetadataManager['fetchMovieRatings']>>>
): Promise<void> {
  const ratingEntries: Array<{
    source: string;
    score: number;
    voteCount?: number;
  }> = [];

  if (ratings.imdb) {
    ratingEntries.push({ source: 'imdb', score: ratings.imdb.score, voteCount: ratings.imdb.voteCount });
  }
  if (ratings.tmdb) {
    ratingEntries.push({ source: 'tmdb', score: ratings.tmdb.score, voteCount: ratings.tmdb.voteCount });
  }
  if (ratings.rottenTomatoesCritics) {
    ratingEntries.push({ source: 'rt_critics', score: ratings.rottenTomatoesCritics.score, voteCount: ratings.rottenTomatoesCritics.voteCount });
  }
  if (ratings.rottenTomatoesAudience) {
    ratingEntries.push({ source: 'rt_audience', score: ratings.rottenTomatoesAudience.score, voteCount: ratings.rottenTomatoesAudience.voteCount });
  }
  if (ratings.metacritic) {
    ratingEntries.push({ source: 'metacritic', score: ratings.metacritic.score, voteCount: ratings.metacritic.voteCount });
  }
  if (ratings.letterboxd) {
    ratingEntries.push({ source: 'letterboxd', score: ratings.letterboxd.score, voteCount: ratings.letterboxd.voteCount });
  }
  if (ratings.trakt) {
    ratingEntries.push({ source: 'trakt', score: ratings.trakt.score, voteCount: ratings.trakt.voteCount });
  }

  for (const entry of ratingEntries) {
    await db.insert(mediaRatings).values({
      mediaType: 'movie',
      mediaId: movieId,
      source: entry.source as 'imdb' | 'rt_critics' | 'rt_audience' | 'metacritic' | 'letterboxd' | 'trakt' | 'tmdb',
      score: entry.score,
      scoreNormalized: normalizeRating(entry.source, entry.score),
      voteCount: entry.voteCount,
    }).onConflictDoUpdate({
      target: [mediaRatings.mediaType, mediaRatings.mediaId, mediaRatings.source],
      set: {
        score: entry.score,
        scoreNormalized: normalizeRating(entry.source, entry.score),
        voteCount: entry.voteCount,
        updatedAt: new Date().toISOString(),
      },
    });
  }
}

/**
 * Normalize rating to 0-100 scale
 */
function normalizeRating(source: string, score: number): number {
  switch (source) {
    case 'imdb':
    case 'tmdb':
    case 'trakt':
      // 0-10 scale -> 0-100
      return score * 10;
    case 'letterboxd':
      // 0-5 scale -> 0-100
      return score * 20;
    default:
      // Already 0-100 (RT, Metacritic)
      return score;
  }
}

/**
 * Fetch metadata for a TV show
 */
export async function fetchShowMetadata(
  db: Database,
  showId: string,
  title?: string,
  year?: number
): Promise<MetadataFetchResult> {
  const log = logger.child({ showId });
  log.info('Fetching show metadata');

  const manager = getMetadataManager();

  // Get show from database
  const show = await db.query.tvShows.findFirst({
    where: eq(tvShows.id, showId),
  });

  if (!show) {
    return { matched: false };
  }

  // Use provided title/year or fall back to database values
  const searchTitle = title ?? show.title;
  const searchYear = year ?? show.year ?? undefined;

  // Skip if already matched
  if (show.matchStatus === 'matched') {
    log.info('Show already matched, skipping');
    return { 
      matched: true, 
      title: show.title, 
      year: show.year ?? undefined,
      provider: 'tmdb',
      externalId: show.tmdbId ? String(show.tmdbId) : undefined,
    };
  }

  try {
    // Fetch complete metadata
    const { details, result } = await manager.fetchCompleteShowMetadata(
      searchTitle,
      searchYear
    );

    if (!result.matched || !details) {
      await db.update(tvShows)
        .set({ matchStatus: 'unmatched' })
        .where(eq(tvShows.id, showId));

      log.info('No metadata match found');
      return { matched: false };
    }

    // Save show metadata
    await saveShowMetadata(db, showId, details);

    // Update show status
    await db.update(tvShows)
      .set({
        matchStatus: 'matched',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tvShows.id, showId));

    // Extract year from first air date
    const firstAirYear = details.firstAirDate
      ? new Date(details.firstAirDate).getFullYear()
      : undefined;

    log.info({ confidence: result.confidence }, 'Show metadata fetched successfully');
    return {
      matched: true,
      title: details.title,
      year: firstAirYear,
      provider: 'tmdb',
      externalId: String(details.externalIds.tmdb),
    };
  } catch (error) {
    log.error({ error }, 'Failed to fetch show metadata');
    return { matched: false };
  }
}

/**
 * Save show metadata to database
 */
async function saveShowMetadata(
  db: Database,
  showId: string,
  details: ShowDetails
): Promise<void> {
  // Update show record
  await db.update(tvShows)
    .set({
      tmdbId: details.externalIds.tmdb,
      imdbId: details.externalIds.imdb,
      title: details.title,
      overview: details.overview,
      firstAirDate: details.firstAirDate,
      lastAirDate: details.lastAirDate,
      status: details.status,
      network: details.networks?.[0]?.name,
      voteAverage: details.voteAverage,
      voteCount: details.voteCount,
      posterPath: details.posterPath,
      backdropPath: details.backdropPath,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tvShows.id, showId));

  // Save genres
  if (details.genres.length > 0) {
    await saveShowGenres(db, showId, details.genres);
  }

  // Save content ratings
  if (details.contentRatings.length > 0) {
    await saveContentRatings(db, 'tvshow', showId, details.contentRatings);
  }

  // Save trailers
  if (details.trailers.length > 0) {
    await saveTrailers(db, 'tvshow', showId, details.trailers);
  }

  // Save external IDs
  await saveExternalIds(db, 'show', showId, details.externalIds);
}

/**
 * Save show genres
 */
async function saveShowGenres(
  db: Database,
  showId: string,
  genreList: ShowDetails['genres']
): Promise<void> {
  // Delete existing genre associations
  await db.delete(showGenres).where(eq(showGenres.showId, showId));

  for (const genre of genreList) {
    // Find or create genre
    let dbGenre = await db.query.genres.findFirst({
      where: eq(genres.tmdbId, genre.id),
    });

    if (!dbGenre) {
      const genreId = generateId();
      await db.insert(genres).values({
        id: genreId,
        tmdbId: genre.id,
        name: genre.name,
      }).onConflictDoNothing();

      dbGenre = { id: genreId, tmdbId: genre.id, name: genre.name };
    }

    // Create association
    await db.insert(showGenres).values({
      showId,
      genreId: dbGenre.id,
    }).onConflictDoNothing();
  }
}

/**
 * Manually identify a movie with a specific external ID
 */
export async function identifyMovie(
  db: Database,
  movieId: string,
  externalId: string,
  provider: string
): Promise<MetadataFetchResult> {
  const log = logger.child({ movieId, externalId, provider });
  log.info('Identifying movie');

  const manager = getMetadataManager();

  try {
    // Fetch metadata using the external ID
    const integration = manager.getIntegration(provider) as MetadataIntegration | undefined;
    if (!integration) {
      return { matched: false, error: `Integration ${provider} not found` };
    }

    // Fetch movie details by ID
    const details = await integration.getMovieDetails(externalId);
    if (!details) {
      return { matched: false, error: 'Movie not found' };
    }

    // Save metadata to database
    await saveMovieMetadata(db, movieId, details);

    // Update movie status
    await db.update(movies)
      .set({
        matchStatus: 'matched',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(movies.id, movieId));

    // Extract year from release date
    const releaseYear = details.releaseDate
      ? new Date(details.releaseDate).getFullYear()
      : undefined;

    log.info({ title: details.title }, 'Movie identified successfully');
    return {
      matched: true,
      title: details.title,
      year: releaseYear,
      provider,
      externalId,
    };
  } catch (error) {
    log.error({ error }, 'Failed to identify movie');
    return { matched: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Manually identify a show with a specific external ID
 */
export async function identifyShow(
  db: Database,
  showId: string,
  externalId: string,
  provider: string
): Promise<MetadataFetchResult> {
  const log = logger.child({ showId, externalId, provider });
  log.info('Identifying show');

  const manager = getMetadataManager();

  try {
    // Fetch metadata using the external ID
    const integration = manager.getIntegration(provider) as MetadataIntegration | undefined;
    if (!integration) {
      return { matched: false, error: `Integration ${provider} not found` };
    }

    // Fetch show details by ID
    const details = await integration.getShowDetails(externalId);
    if (!details) {
      return { matched: false, error: 'Show not found' };
    }

    // Save metadata to database
    await saveShowMetadata(db, showId, details);

    // Update show status
    await db.update(tvShows)
      .set({
        matchStatus: 'matched',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tvShows.id, showId));

    // Extract year from first air date
    const firstAirYear = details.firstAirDate
      ? new Date(details.firstAirDate).getFullYear()
      : undefined;

    log.info({ title: details.title }, 'Show identified successfully');
    return {
      matched: true,
      title: details.title,
      year: firstAirYear,
      provider,
      externalId,
    };
  } catch (error) {
    log.error({ error }, 'Failed to identify show');
    return { matched: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch metadata for all pending movies in a library
 */
export async function fetchPendingMovieMetadata(
  db: Database,
  libraryId?: string
): Promise<{ matched: number; unmatched: number; errors: number }> {
  const log = logger.child({ libraryId });
  log.info('Fetching metadata for pending movies');

  const whereClause = libraryId
    ? and(eq(movies.matchStatus, 'pending'), eq(movies.libraryId, libraryId))
    : eq(movies.matchStatus, 'pending');

  const pendingMovies = await db.query.movies.findMany({
    where: whereClause,
  });

  const stats = { matched: 0, unmatched: 0, errors: 0 };

  for (const movie of pendingMovies) {
    try {
      const result = await fetchMovieMetadata(db, movie.id);
      if (result.matched) {
        stats.matched++;
      } else if (result.error) {
        stats.errors++;
      } else {
        stats.unmatched++;
      }
    } catch {
      stats.errors++;
    }
  }

  log.info(stats, 'Finished fetching pending movie metadata');
  return stats;
}

/**
 * Fetch metadata for all pending shows in a library
 */
export async function fetchPendingShowMetadata(
  db: Database,
  libraryId?: string
): Promise<{ matched: number; unmatched: number; errors: number }> {
  const log = logger.child({ libraryId });
  log.info('Fetching metadata for pending shows');

  const whereClause = libraryId
    ? and(eq(tvShows.matchStatus, 'pending'), eq(tvShows.libraryId, libraryId))
    : eq(tvShows.matchStatus, 'pending');

  const pendingShows = await db.query.tvShows.findMany({
    where: whereClause,
  });

  const stats = { matched: 0, unmatched: 0, errors: 0 };

  for (const show of pendingShows) {
    try {
      const result = await fetchShowMetadata(db, show.id);
      if (result.matched) {
        stats.matched++;
      } else if (result.error) {
        stats.errors++;
      } else {
        stats.unmatched++;
      }
    } catch {
      stats.errors++;
    }
  }

  log.info(stats, 'Finished fetching pending show metadata');
  return stats;
}
