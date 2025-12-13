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
  seasons,
  episodes,
  genres,
  movieGenres,
  showGenres,
  people,
  movieCredits,
  showCredits,
  contentRatings,
  trailers,
  externalIds,
  mediaRatings,
  providerMetadata,
  providerCredits,
  providerEpisodes,
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
  type ExternalIds,
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
 * Fetch metadata for a single movie from ALL configured providers.
 * 
 * This uses the new multi-provider architecture:
 * 1. Fetches metadata from ALL enabled providers in parallel
 * 2. Stores each provider's data in provider_metadata table
 * 3. Updates the main movies table with the default provider's data
 * 4. Enables instant provider switching in the UI
 */
export async function fetchMovieMetadata(
  db: Database,
  movieId: string,
  title?: string,
  year?: number,
  forceRefresh = false
): Promise<MetadataFetchResult> {
  const log = logger.child({ movieId });
  log.info('Fetching movie metadata from all providers');

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
  if (movie.matchStatus === 'matched' && !forceRefresh) {
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
    // Fetch metadata from ALL providers
    const { providerData, ratings, result, externalIds: allExternalIds } = 
      await manager.fetchAllMovieProviderMetadata(searchTitle, searchYear);

    if (!result.matched || Object.keys(providerData).length === 0) {
      // Mark as unmatched
      await db.update(movies)
        .set({ matchStatus: 'unmatched' })
        .where(eq(movies.id, movieId));

      log.info('No metadata match found');
      return { matched: false };
    }

    // Save metadata from EACH provider to provider_metadata table
    const providersSaved: string[] = [];
    for (const [provider, details] of Object.entries(providerData)) {
      try {
        await saveProviderMovieMetadata(db, movieId, provider, details);
        providersSaved.push(provider);
        log.debug({ provider }, 'Saved provider metadata');
      } catch (error) {
        log.error({ error, provider }, 'Failed to save provider metadata');
      }
    }

    // Save all external IDs from all providers
    await saveAllExternalIds(db, 'movie', movieId, allExternalIds);

    // Get the default display provider (prefer tmdb, fall back to first available)
    const providerKeys = Object.keys(providerData);
    const displayProvider = providerData['tmdb'] 
      ? 'tmdb' 
      : providerKeys[0];

    if (!displayProvider) {
      log.error('No providers returned data');
      return { matched: false };
    }

    const displayDetails = providerData[displayProvider];

    if (!displayDetails) {
      log.error('No display details available despite having provider data');
      return { matched: false };
    }

    // Save to the main movies table for backwards compatibility
    // This uses the default display provider's data
    await saveMovieMetadata(db, movieId, displayDetails);

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
    const releaseYear = displayDetails.releaseDate
      ? new Date(displayDetails.releaseDate).getFullYear()
      : undefined;

    log.info({ 
      confidence: result.confidence, 
      providers: providersSaved,
      displayProvider,
    }, 'Movie metadata fetched from all providers successfully');

    return {
      matched: true,
      title: displayDetails.title,
      year: releaseYear,
      provider: displayProvider,
      externalId: displayDetails.externalIds.tmdb 
        ? String(displayDetails.externalIds.tmdb) 
        : undefined,
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
  // Extract genre names for the JSON column
  const genreNames = details.genres.map((g) => g.name);

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
      genres: JSON.stringify(genreNames), // Store genres as JSON array for filtering
      originalLanguage: details.originalLanguage,
      originCountry: details.originCountry ? JSON.stringify(details.originCountry) : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(movies.id, movieId));

  // Save genres to normalized table
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
 * Save show cast and crew
 */
async function saveShowCredits(
  db: Database,
  showId: string,
  cast: ShowDetails['cast'],
  crew: ShowDetails['crew']
): Promise<void> {
  // Delete existing credits
  await db.delete(showCredits).where(eq(showCredits.showId, showId));

  // Save cast
  for (const member of cast) {
    const personId = await findOrCreatePerson(db, member);

    await db.insert(showCredits).values({
      id: generateId(),
      showId,
      personId,
      roleType: 'cast',
      character: member.character,
      creditOrder: member.order,
    });
  }

  // Save crew
  for (const member of crew) {
    const personId = await findOrCreatePerson(db, member);

    await db.insert(showCredits).values({
      id: generateId(),
      showId,
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
 * Save provider-specific metadata for a movie.
 * This stores the complete metadata from each provider separately,
 * enabling instant provider switching in the UI.
 */
async function saveProviderMovieMetadata(
  db: Database,
  movieId: string,
  provider: string,
  details: MovieDetails
): Promise<void> {
  const genreNames = details.genres.map((g) => g.name);
  
  await db.insert(providerMetadata).values({
    mediaType: 'movie',
    mediaId: movieId,
    provider: provider as 'tmdb' | 'tvdb' | 'anidb' | 'anilist' | 'mal' | 'omdb' | 'trakt',
    title: details.title,
    originalTitle: details.originalTitle,
    sortTitle: details.title?.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
    tagline: details.tagline,
    overview: details.overview,
    releaseDate: details.releaseDate,
    runtime: details.runtime,
    voteAverage: details.voteAverage,
    voteCount: details.voteCount,
    popularity: details.popularity,
    posterPath: details.posterPath,
    backdropPath: details.backdropPath,
    logoPath: details.logoPath,
    genres: JSON.stringify(genreNames),
    contentRatings: JSON.stringify(details.contentRatings),
    productionCompanies: JSON.stringify(details.productionCompanies),
    trailers: JSON.stringify(details.trailers),
    homepage: details.homepage,
    budget: details.budget,
    revenue: details.revenue,
    productionCountries: JSON.stringify(details.productionCountries),
    spokenLanguages: JSON.stringify(details.spokenLanguages),
    fetchedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: [providerMetadata.mediaType, providerMetadata.mediaId, providerMetadata.provider],
    set: {
      title: details.title,
      originalTitle: details.originalTitle,
      tagline: details.tagline,
      overview: details.overview,
      releaseDate: details.releaseDate,
      runtime: details.runtime,
      voteAverage: details.voteAverage,
      voteCount: details.voteCount,
      popularity: details.popularity,
      posterPath: details.posterPath,
      backdropPath: details.backdropPath,
      logoPath: details.logoPath,
      genres: JSON.stringify(genreNames),
      contentRatings: JSON.stringify(details.contentRatings),
      productionCompanies: JSON.stringify(details.productionCompanies),
      trailers: JSON.stringify(details.trailers),
      homepage: details.homepage,
      budget: details.budget,
      revenue: details.revenue,
      productionCountries: JSON.stringify(details.productionCountries),
      spokenLanguages: JSON.stringify(details.spokenLanguages),
      updatedAt: new Date().toISOString(),
    },
  });

  // Save provider-specific credits
  await saveProviderCredits(db, 'movie', movieId, provider, details.cast, details.crew);
}

/**
 * Save provider-specific metadata for a show.
 */
async function saveProviderShowMetadata(
  db: Database,
  showId: string,
  provider: string,
  details: ShowDetails
): Promise<void> {
  const genreNames = details.genres.map((g) => g.name);
  
  await db.insert(providerMetadata).values({
    mediaType: 'show',
    mediaId: showId,
    provider: provider as 'tmdb' | 'tvdb' | 'anidb' | 'anilist' | 'mal' | 'omdb' | 'trakt',
    title: details.title,
    originalTitle: details.originalTitle,
    sortTitle: details.title?.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
    tagline: details.tagline,
    overview: details.overview,
    releaseDate: details.firstAirDate,
    lastAirDate: details.lastAirDate,
    status: details.status,
    voteAverage: details.voteAverage,
    voteCount: details.voteCount,
    popularity: details.popularity,
    posterPath: details.posterPath,
    backdropPath: details.backdropPath,
    logoPath: details.logoPath,
    genres: JSON.stringify(genreNames),
    contentRatings: JSON.stringify(details.contentRatings),
    networks: JSON.stringify(details.networks),
    productionCompanies: JSON.stringify(details.productionCompanies),
    trailers: JSON.stringify(details.trailers),
    seasons: JSON.stringify(details.seasons),
    seasonCount: details.numberOfSeasons,
    episodeCount: details.numberOfEpisodes,
    homepage: details.homepage,
    originCountry: JSON.stringify(details.originCountry),
    originalLanguage: details.originalLanguage,
    fetchedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: [providerMetadata.mediaType, providerMetadata.mediaId, providerMetadata.provider],
    set: {
      title: details.title,
      originalTitle: details.originalTitle,
      tagline: details.tagline,
      overview: details.overview,
      releaseDate: details.firstAirDate,
      lastAirDate: details.lastAirDate,
      status: details.status,
      voteAverage: details.voteAverage,
      voteCount: details.voteCount,
      popularity: details.popularity,
      posterPath: details.posterPath,
      backdropPath: details.backdropPath,
      logoPath: details.logoPath,
      genres: JSON.stringify(genreNames),
      contentRatings: JSON.stringify(details.contentRatings),
      networks: JSON.stringify(details.networks),
      productionCompanies: JSON.stringify(details.productionCompanies),
      trailers: JSON.stringify(details.trailers),
      seasons: JSON.stringify(details.seasons),
      seasonCount: details.numberOfSeasons,
      episodeCount: details.numberOfEpisodes,
      homepage: details.homepage,
      originCountry: JSON.stringify(details.originCountry),
      originalLanguage: details.originalLanguage,
      updatedAt: new Date().toISOString(),
    },
  });

  // Save provider-specific credits
  await saveProviderCredits(db, 'show', showId, provider, details.cast, details.crew);
}

/**
 * Save provider-specific cast and crew credits.
 */
async function saveProviderCredits(
  db: Database,
  mediaType: 'movie' | 'show',
  mediaId: string,
  provider: string,
  cast: MovieDetails['cast'],
  crew: MovieDetails['crew']
): Promise<void> {
  // Delete existing credits for this media+provider
  await db.delete(providerCredits)
    .where(and(
      eq(providerCredits.mediaType, mediaType),
      eq(providerCredits.mediaId, mediaId),
      eq(providerCredits.provider, provider as 'tmdb' | 'tvdb' | 'anidb' | 'anilist' | 'mal' | 'omdb' | 'trakt')
    ));

  // Save cast
  for (const member of cast) {
    await db.insert(providerCredits).values({
      id: generateId(),
      mediaType,
      mediaId,
      provider: provider as 'tmdb' | 'tvdb' | 'anidb' | 'anilist' | 'mal' | 'omdb' | 'trakt',
      roleType: 'cast',
      name: member.name,
      externalPersonId: member.id,
      profilePath: member.profilePath,
      character: member.character,
      creditOrder: member.order,
    });
  }

  // Save crew (limit to important roles)
  const importantJobs = ['Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer', 'Creator'];
  const importantCrew = crew.filter(c => importantJobs.includes(c.job));
  
  for (const member of importantCrew) {
    await db.insert(providerCredits).values({
      id: generateId(),
      mediaType,
      mediaId,
      provider: provider as 'tmdb' | 'tvdb' | 'anidb' | 'anilist' | 'mal' | 'omdb' | 'trakt',
      roleType: 'crew',
      name: member.name,
      externalPersonId: member.id,
      profilePath: member.profilePath,
      department: member.department,
      job: member.job,
    });
  }
}

/**
 * Save all external IDs from the merged external IDs object.
 */
async function saveAllExternalIds(
  db: Database,
  mediaType: 'movie' | 'show',
  mediaId: string,
  ids: ExternalIds
): Promise<void> {
  const idMap: Array<{ provider: string; externalId: string | number | undefined }> = [
    { provider: 'tmdb', externalId: ids.tmdb },
    { provider: 'imdb', externalId: ids.imdb },
    { provider: 'tvdb', externalId: ids.tvdb },
    { provider: 'trakt', externalId: ids.trakt },
    { provider: 'anidb', externalId: ids.anidb },
    { provider: 'anilist', externalId: ids.anilist },
    { provider: 'mal', externalId: ids.mal },
  ];

  for (const { provider, externalId } of idMap) {
    if (externalId !== undefined) {
      await db.insert(externalIds).values({
        mediaType,
        mediaId,
        provider: provider as 'tmdb' | 'imdb' | 'tvdb' | 'trakt' | 'anidb' | 'anilist' | 'mal',
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
 * Save show ratings from aggregator
 */
async function saveShowRatings(
  db: Database,
  showId: string,
  ratings: NonNullable<Awaited<ReturnType<MetadataManager['fetchShowRatings']>>>
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
      mediaType: 'show',
      mediaId: showId,
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
 * Fetch metadata for a TV show from ALL configured providers.
 * 
 * This uses the new multi-provider architecture:
 * 1. Fetches metadata from ALL enabled providers in parallel
 * 2. Stores each provider's data in provider_metadata table
 * 3. Updates the main tvShows table with the default provider's data
 * 4. Enables instant provider switching in the UI
 */
export async function fetchShowMetadata(
  db: Database,
  showId: string,
  title?: string,
  year?: number,
  forceRefresh = false
): Promise<MetadataFetchResult> {
  const log = logger.child({ showId });
  log.info('Fetching show metadata from all providers');

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

  // Skip if already matched and not forcing refresh
  if (show.matchStatus === 'matched' && !forceRefresh) {
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
    // Fetch metadata from ALL providers
    const { providerData, ratings, result, externalIds: allExternalIds } = 
      await manager.fetchAllShowProviderMetadata(searchTitle, searchYear);

    if (!result.matched || Object.keys(providerData).length === 0) {
      await db.update(tvShows)
        .set({ matchStatus: 'unmatched' })
        .where(eq(tvShows.id, showId));

      log.info('No metadata match found');
      return { matched: false };
    }

    // Save metadata from EACH provider to provider_metadata table
    const providersSaved: string[] = [];
    for (const [provider, details] of Object.entries(providerData)) {
      try {
        await saveProviderShowMetadata(db, showId, provider, details);
        providersSaved.push(provider);
        log.debug({ provider }, 'Saved provider metadata');
      } catch (error) {
        log.error({ error, provider }, 'Failed to save provider metadata');
      }
    }

    // Save all external IDs from all providers
    await saveAllExternalIds(db, 'show', showId, allExternalIds);

    // Get the default display provider (prefer tmdb, fall back to first available)
    const providerKeys = Object.keys(providerData);
    const displayProvider = providerData['tmdb'] 
      ? 'tmdb' 
      : providerKeys[0];

    if (!displayProvider) {
      log.error('No providers returned data');
      return { matched: false };
    }

    const displayDetails = providerData[displayProvider];

    if (!displayDetails) {
      log.error('No display details available despite having provider data');
      return { matched: false };
    }

    // Save to the main tvShows table for backwards compatibility
    await saveShowMetadata(db, showId, displayDetails);

    // Save ratings if available
    if (ratings) {
      await saveShowRatings(db, showId, ratings);
    }

    // Update show status
    await db.update(tvShows)
      .set({
        matchStatus: 'matched',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tvShows.id, showId));

    // Extract year from first air date
    const firstAirYear = displayDetails.firstAirDate
      ? new Date(displayDetails.firstAirDate).getFullYear()
      : undefined;

    log.info({ 
      confidence: result.confidence, 
      providers: providersSaved,
      displayProvider,
    }, 'Show metadata fetched from all providers successfully');

    return {
      matched: true,
      title: displayDetails.title,
      year: firstAirYear,
      provider: displayProvider,
      externalId: displayDetails.externalIds.tmdb 
        ? String(displayDetails.externalIds.tmdb) 
        : undefined,
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
  // Extract genre names for the JSON column
  const genreNames = details.genres.map((g) => g.name);

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
      networkLogoPath: details.networks?.[0]?.logoPath,
      voteAverage: details.voteAverage,
      voteCount: details.voteCount,
      posterPath: details.posterPath,
      backdropPath: details.backdropPath,
      genres: JSON.stringify(genreNames), // Store genres as JSON array for filtering
      originalLanguage: details.originalLanguage,
      originCountry: details.originCountry ? JSON.stringify(details.originCountry) : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tvShows.id, showId));

  // Save genres to normalized table
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

  // Save cast/crew
  if ((details.cast?.length ?? 0) > 0 || (details.crew?.length ?? 0) > 0) {
    await saveShowCredits(db, showId, details.cast ?? [], details.crew ?? []);
  }

  // Save external IDs
  await saveExternalIds(db, 'show', showId, details.externalIds);

  // Fetch and save season/episode metadata
  if (details.externalIds.tmdb) {
    await saveSeasonAndEpisodeMetadata(db, showId, String(details.externalIds.tmdb));
  }
}

/**
 * Fetch and save season and episode metadata from TMDB
 */
async function saveSeasonAndEpisodeMetadata(
  db: Database,
  showId: string,
  tmdbShowId: string
): Promise<void> {
  const log = logger.child({ showId, tmdbShowId });
  log.info('Fetching season and episode metadata');

  const manager = getMetadataManager();
  const tmdb = manager.getIntegration<MetadataIntegration>('tmdb');

  if (!tmdb) {
    log.warn('TMDB integration not available, skipping episode metadata');
    return;
  }

  // Get all seasons for this show from our database
  const dbSeasons = await db.query.seasons.findMany({
    where: eq(seasons.showId, showId),
  });

  for (const dbSeason of dbSeasons) {
    try {
      // Fetch season details from TMDB (includes episodes)
      const seasonDetails = await tmdb.getSeasonDetails(tmdbShowId, dbSeason.seasonNumber);

      // Update season record
      await db.update(seasons)
        .set({
          tmdbId: seasonDetails.externalIds.tmdb,
          name: seasonDetails.name,
          overview: seasonDetails.overview,
          airDate: seasonDetails.airDate,
          posterPath: seasonDetails.posterPath,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(seasons.id, dbSeason.id));

      // Get all episodes for this season from our database
      const dbEpisodes = await db.query.episodes.findMany({
        where: eq(episodes.seasonId, dbSeason.id),
      });

      // Match and update episodes by episode number
      for (const dbEpisode of dbEpisodes) {
        const tmdbEpisode = seasonDetails.episodes.find(
          (e) => e.episodeNumber === dbEpisode.episodeNumber
        );

        if (tmdbEpisode) {
          await db.update(episodes)
            .set({
              tmdbId: tmdbEpisode.externalIds.tmdb,
              title: tmdbEpisode.title,
              overview: tmdbEpisode.overview,
              airDate: tmdbEpisode.airDate,
              runtime: tmdbEpisode.runtime,
              stillPath: tmdbEpisode.stillPath,
              voteAverage: tmdbEpisode.voteAverage,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(episodes.id, dbEpisode.id));

          // Save episode metadata to provider_episodes table (includes guest stars)
          await db.insert(providerEpisodes)
            .values({
              episodeId: dbEpisode.id,
              provider: 'tmdb',
              seasonNumber: dbEpisode.seasonNumber,
              episodeNumber: dbEpisode.episodeNumber,
              title: tmdbEpisode.title,
              overview: tmdbEpisode.overview,
              airDate: tmdbEpisode.airDate,
              runtime: tmdbEpisode.runtime,
              stillPath: tmdbEpisode.stillPath,
              voteAverage: tmdbEpisode.voteAverage,
              voteCount: tmdbEpisode.voteCount,
              guestStars: tmdbEpisode.guestStars ? JSON.stringify(tmdbEpisode.guestStars) : null,
              crew: tmdbEpisode.crew ? JSON.stringify(tmdbEpisode.crew) : null,
            })
            .onConflictDoUpdate({
              target: [providerEpisodes.episodeId, providerEpisodes.provider],
              set: {
                title: tmdbEpisode.title,
                overview: tmdbEpisode.overview,
                airDate: tmdbEpisode.airDate,
                runtime: tmdbEpisode.runtime,
                stillPath: tmdbEpisode.stillPath,
                voteAverage: tmdbEpisode.voteAverage,
                voteCount: tmdbEpisode.voteCount,
                guestStars: tmdbEpisode.guestStars ? JSON.stringify(tmdbEpisode.guestStars) : null,
                crew: tmdbEpisode.crew ? JSON.stringify(tmdbEpisode.crew) : null,
                fetchedAt: new Date().toISOString(),
              },
            });
        }
      }

      log.debug({ seasonNumber: dbSeason.seasonNumber }, 'Updated season metadata');
    } catch (error) {
      log.error({ error, seasonNumber: dbSeason.seasonNumber }, 'Failed to fetch season metadata');
      // Continue with other seasons
    }
  }

  log.info('Season and episode metadata fetch completed');
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
