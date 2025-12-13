/**
 * TVDb Integration - TV series metadata provider
 *
 * TVDb (TheTVDB) is particularly strong for:
 * - TV series with detailed episode information
 * - Anime with proper episode ordering
 * - International TV content
 */

import type { MetadataIntegration } from '../../interfaces/metadata.js';
import type {
  IntegrationConfig,
  SearchResult,
  MovieDetails,
  ShowDetails,
  SeasonDetails,
  EpisodeDetails,
  Genre,
  SeasonInfo,
} from '../../types.js';
import { TvdbClient } from './client.js';
import { createTvdbConfig, type TvdbConfig } from './config.js';
import type { TvdbSeries, TvdbEpisode, TvdbSearchResult } from './types.js';
import { ARTWORK_TYPES } from './types.js';

export { TvdbClient } from './client.js';
export type { TvdbConfig } from './config.js';
export * from './types.js';

/**
 * TVDb Integration - provides TV series metadata with excellent anime support
 */
export class TvdbIntegration implements MetadataIntegration {
  readonly id = 'tvdb';
  readonly name = 'TheTVDB';
  readonly description = 'TV series metadata with excellent anime and episode support';
  readonly apiKeyUrl = 'https://thetvdb.com/api-information';
  readonly requiresApiKey = true;
  readonly usesOAuth = false;
  readonly providesMetadata = true;
  readonly supportsMovies = false; // TVDb is TV-focused
  readonly supportsShows = true;
  readonly supportsAnime = true;
  readonly ratingSources = ['tvdb'];

  private config: TvdbConfig | null = null;
  private client: TvdbClient | null = null;

  async initialize(config: IntegrationConfig): Promise<void> {
    // Don't initialize client if no API key - will be marked as not ready
    if (!config.apiKey) {
      return;
    }

    this.config = createTvdbConfig(config.apiKey, {
      pin: config.options?.pin as string,
      language: config.options?.language as string ?? 'eng',
    });

    this.client = new TvdbClient(this.config);
    // Pre-authenticate to validate API key
    try {
      await this.client.login();
    } catch (error) {
      // Login failed - client will be marked as not ready
      this.client = null;
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Not initialized' };
    }

    try {
      // Search for a well-known show (Game of Thrones)
      const results = await this.client.search('Game of Thrones', 'series');
      if (results.length > 0) {
        return { success: true };
      }
      return { success: false, error: 'Could not fetch test data' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  isReady(): boolean {
    return this.client !== null;
  }

  // ============================================================
  // Movie Methods (Not supported - TVDb is TV-focused)
  // ============================================================

  async searchMovies(_query: string, _year?: number): Promise<SearchResult[]> {
    // TVDb is primarily for TV shows
    return [];
  }

  async getMovieDetails(_integrationId: string): Promise<MovieDetails> {
    throw new Error('TVDb does not support movie metadata');
  }

  // ============================================================
  // TV Show Methods (Primary purpose)
  // ============================================================

  async searchShows(query: string, year?: number): Promise<SearchResult[]> {
    if (!this.client) {
      throw new Error('TVDb not initialized');
    }

    const results = await this.client.search(query, 'series');

    return results
      .filter((r) => {
        // Filter by year if provided
        if (year && r.year) {
          const resultYear = parseInt(r.year, 10);
          if (Math.abs(resultYear - year) > 1) return false;
        }
        return true;
      })
      .map((r) => this.mapSearchResult(r, year));
  }

  async getShowDetails(integrationId: string): Promise<ShowDetails> {
    if (!this.client) {
      throw new Error('TVDb not initialized');
    }

    const id = parseInt(integrationId, 10);
    if (isNaN(id)) {
      throw new Error(`Invalid TVDb ID: ${integrationId}`);
    }

    const series = await this.client.getSeries(id);
    if (!series) {
      throw new Error(`Show not found: ${integrationId}`);
    }

    return this.mapSeriesDetails(series);
  }

  async getSeasonDetails(showId: string, seasonNumber: number): Promise<SeasonDetails> {
    if (!this.client) {
      throw new Error('TVDb not initialized');
    }

    const id = parseInt(showId, 10);
    if (isNaN(id)) {
      throw new Error(`Invalid TVDb ID: ${showId}`);
    }

    // Get all episodes and filter by season
    const episodes = await this.client.getSeriesEpisodes(id);
    const seasonEpisodes = episodes.filter((e) => e.seasonNumber === seasonNumber);

    if (seasonEpisodes.length === 0) {
      throw new Error(`Season ${seasonNumber} not found for show ${showId}`);
    }

    // Get series for season poster
    const series = await this.client.getSeries(id);

    return {
      seasonNumber,
      name: `Season ${seasonNumber}`,
      episodes: seasonEpisodes.map((e) => this.mapEpisode(e)),
      posterPath: series?.image,
      externalIds: {
        tvdb: id,
      },
    };
  }

  async getEpisodeDetails(
    showId: string,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<EpisodeDetails> {
    if (!this.client) {
      throw new Error('TVDb not initialized');
    }

    const id = parseInt(showId, 10);
    if (isNaN(id)) {
      throw new Error(`Invalid TVDb ID: ${showId}`);
    }

    // Get all episodes and find the specific one
    const episodes = await this.client.getSeriesEpisodes(id);
    const ep = episodes.find(
      (e) => e.seasonNumber === seasonNumber && e.number === episodeNumber
    );

    if (!ep) {
      throw new Error(`Episode S${seasonNumber}E${episodeNumber} not found for show ${showId}`);
    }

    // Get extended episode details
    const fullEpisode = await this.client.getEpisode(ep.id);
    return this.mapEpisode(fullEpisode ?? ep);
  }

  /**
   * Get the underlying client for advanced usage
   */
  getClient(): TvdbClient {
    if (!this.client) {
      throw new Error('TVDb not initialized');
    }
    return this.client;
  }

  // ============================================================
  // Image URL Helper
  // ============================================================

  /**
   * Get full image URL from TVDb image path
   */
  static getImageUrl(path: string): string {
    if (path.startsWith('http')) {
      return path;
    }
    return `https://artworks.thetvdb.com${path.startsWith('/') ? '' : '/'}${path}`;
  }

  // ============================================================
  // Private Mappers
  // ============================================================

  private mapSearchResult(result: TvdbSearchResult, searchYear?: number): SearchResult {
    let confidence = 0.6;

    // Boost confidence if year matches
    if (searchYear && result.year) {
      const resultYear = parseInt(result.year, 10);
      if (resultYear === searchYear) {
        confidence = 0.9;
      } else if (Math.abs(resultYear - searchYear) === 1) {
        confidence = 0.7;
      }
    }

    return {
      integration: this.id,
      integrationId: result.tvdb_id,
      title: result.name,
      year: result.year ? parseInt(result.year, 10) : undefined,
      overview: result.overview,
      posterPath: result.image_url,
      mediaType: 'tvshow',
      popularity: confidence * 100, // Use confidence as pseudo-popularity
    };
  }

  private mapSeriesDetails(series: TvdbSeries): ShowDetails {
    // Find poster and backdrop from artworks
    const poster = series.artworks?.find((a) => a.type === ARTWORK_TYPES.POSTER);
    const backdrop = series.artworks?.find((a) => a.type === ARTWORK_TYPES.BACKGROUND);

    // Map genres
    const genres: Genre[] = series.genres?.map((g, i) => ({
      id: g.id ?? i,
      name: g.name,
    })) ?? [];

    // Map seasons
    const seasons: SeasonInfo[] = series.seasons?.map((s) => ({
      seasonNumber: s.number,
      name: s.name ?? `Season ${s.number}`,
      posterPath: s.image,
    })) ?? [];

    return {
      externalIds: {
        tvdb: series.id,
        imdb: TvdbClient.extractImdbId(series.remoteIds),
        tmdb: TvdbClient.extractTmdbId(series.remoteIds),
      },
      title: series.name,
      overview: series.overview,
      firstAirDate: series.firstAired,
      lastAirDate: series.lastAired,
      status: series.status?.name,
      posterPath: poster?.image ?? series.image,
      backdropPath: backdrop?.image,
      voteAverage: series.score ? series.score / 10 : undefined, // TVDb score is 0-100
      genres,
      cast: [],
      crew: [],
      contentRatings: [],
      trailers: [],
      seasons,
      numberOfSeasons: seasons.length,
      numberOfEpisodes: series.episodes?.length,
      episodeRuntime: series.averageRuntime ? [series.averageRuntime] : undefined,
      networks: series.originalNetwork ? [{
        id: series.originalNetwork.id,
        name: series.originalNetwork.name,
        originCountry: series.originalNetwork.country,
      }] : undefined,
    };
  }

  private mapEpisode(episode: TvdbEpisode): EpisodeDetails {
    return {
      externalIds: {
        tvdb: episode.id,
      },
      seasonNumber: episode.seasonNumber ?? 1,
      episodeNumber: episode.number ?? 1,
      title: episode.name ?? `Episode ${episode.number}`,
      overview: episode.overview,
      airDate: episode.aired,
      runtime: episode.runtime,
      stillPath: episode.image,
    };
  }
}

