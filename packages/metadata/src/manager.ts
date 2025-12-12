/**
 * MetadataManager - Orchestrates metadata fetching across integrations
 */

import type {
  BaseIntegration,
  IntegrationInfo,
  MetadataIntegration,
  ArtworkIntegration,
  RatingsIntegration,
  SyncIntegration,
} from './interfaces/index.js';
import {
  isMetadataIntegration,
  isArtworkIntegration,
  isRatingsIntegration,
  isSyncIntegration,
} from './interfaces/index.js';
import type {
  MetadataSettings,
  IntegrationConfig,
  SearchResult,
  ScoredSearchResult,
  MovieDetails,
  ShowDetails,
  Artwork,
  AggregateRatings,
  MatchResult,
} from './types.js';
import { scoreSearchResults, findBestMatch, DEFAULT_MATCHER_CONFIG } from './matcher.js';

/**
 * MetadataManager manages all metadata integrations and coordinates
 * metadata fetching across multiple sources
 */
export class MetadataManager {
  private integrations: Map<string, BaseIntegration> = new Map();
  private settings: MetadataSettings;

  constructor(settings: MetadataSettings) {
    this.settings = settings;
  }

  /**
   * Register an integration
   */
  registerIntegration(integration: BaseIntegration): void {
    this.integrations.set(integration.id, integration);
  }

  /**
   * Initialize all registered integrations with their configs
   */
  async initializeAll(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    for (const [id, integration] of this.integrations) {
      const config = this.settings.integrations[id];
      if (config) {
        initPromises.push(integration.initialize(config));
      }
    }

    await Promise.all(initPromises);
  }

  /**
   * Get an integration by ID
   */
  getIntegration<T extends BaseIntegration>(id: string): T | undefined {
    return this.integrations.get(id) as T | undefined;
  }

  /**
   * Get all metadata integrations
   */
  getMetadataIntegrations(): MetadataIntegration[] {
    return Array.from(this.integrations.values()).filter(isMetadataIntegration);
  }

  /**
   * Get the artwork integration (Fanart.tv)
   */
  getArtworkIntegration(): ArtworkIntegration | undefined {
    return Array.from(this.integrations.values()).find(isArtworkIntegration);
  }

  /**
   * Get the ratings integration (MDBList)
   */
  getRatingsIntegration(): RatingsIntegration | undefined {
    return Array.from(this.integrations.values()).find(isRatingsIntegration);
  }

  /**
   * Get the sync integration (Trakt)
   */
  getSyncIntegration(): SyncIntegration | undefined {
    return Array.from(this.integrations.values()).find(isSyncIntegration);
  }

  /**
   * Get info about all registered integrations
   */
  getIntegrationInfos(): IntegrationInfo[] {
    return Array.from(this.integrations.values()).map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      apiKeyUrl: i.apiKeyUrl,
      requiresApiKey: i.requiresApiKey,
      usesOAuth: i.usesOAuth,
      providesMetadata: i.providesMetadata,
      supportsMovies: i.supportsMovies,
      supportsShows: i.supportsShows,
      supportsAnime: i.supportsAnime,
      ratingSources: i.ratingSources,
    }));
  }

  /**
   * Check if an integration is enabled and ready
   */
  isIntegrationReady(id: string): boolean {
    const integration = this.integrations.get(id);
    const config = this.settings.integrations[id];
    return !!(integration && config?.enabled && integration.isReady());
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<MetadataSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Update a single integration config
   */
  async updateIntegrationConfig(
    id: string,
    config: Partial<IntegrationConfig>
  ): Promise<void> {
    const currentConfig = this.settings.integrations[id];
    if (currentConfig) {
      this.settings.integrations[id] = { ...currentConfig, ...config };

      const integration = this.integrations.get(id);
      if (integration) {
        await integration.initialize(this.settings.integrations[id]!);
      }
    }
  }

  /**
   * Search for movies across all enabled metadata integrations
   */
  async searchMovies(
    query: string,
    year?: number
  ): Promise<ScoredSearchResult[]> {
    const results: SearchResult[] = [];

    for (const integrationId of this.settings.movieIntegrations) {
      if (!this.isIntegrationReady(integrationId)) continue;

      const integration = this.getIntegration<MetadataIntegration>(integrationId);
      if (!integration || !isMetadataIntegration(integration)) continue;

      try {
        const integrationResults = await integration.searchMovies(query, year);
        results.push(...integrationResults);
      } catch (error) {
        console.error(`Error searching movies with ${integrationId}:`, error);
      }
    }

    return scoreSearchResults(query, year, results);
  }

  /**
   * Search for TV shows across all enabled metadata integrations
   */
  async searchShows(
    query: string,
    year?: number
  ): Promise<ScoredSearchResult[]> {
    const results: SearchResult[] = [];

    for (const integrationId of this.settings.tvIntegrations) {
      if (!this.isIntegrationReady(integrationId)) continue;

      const integration = this.getIntegration<MetadataIntegration>(integrationId);
      if (!integration || !isMetadataIntegration(integration)) continue;

      try {
        const integrationResults = await integration.searchShows(query, year);
        results.push(...integrationResults);
      } catch (error) {
        console.error(`Error searching shows with ${integrationId}:`, error);
      }
    }

    return scoreSearchResults(query, year, results);
  }

  /**
   * Find the best movie match
   */
  async findBestMovieMatch(
    title: string,
    year?: number
  ): Promise<ScoredSearchResult | null> {
    const results = await this.searchMovies(title, year);
    return findBestMatch(title, year, results, this.settings.autoMatchThreshold);
  }

  /**
   * Find the best TV show match
   */
  async findBestShowMatch(
    title: string,
    year?: number
  ): Promise<ScoredSearchResult | null> {
    const results = await this.searchShows(title, year);
    return findBestMatch(title, year, results, this.settings.autoMatchThreshold);
  }

  /**
   * Fetch complete movie metadata from a specific integration
   */
  async fetchMovieDetails(
    integrationId: string,
    externalId: string
  ): Promise<MovieDetails | null> {
    const integration = this.getIntegration<MetadataIntegration>(integrationId);
    if (!integration || !isMetadataIntegration(integration)) {
      return null;
    }

    return integration.getMovieDetails(externalId);
  }

  /**
   * Fetch complete TV show metadata from a specific integration
   */
  async fetchShowDetails(
    integrationId: string,
    externalId: string
  ): Promise<ShowDetails | null> {
    const integration = this.getIntegration<MetadataIntegration>(integrationId);
    if (!integration || !isMetadataIntegration(integration)) {
      return null;
    }

    return integration.getShowDetails(externalId);
  }

  /**
   * Fetch artwork from Fanart.tv (if enabled)
   */
  async fetchMovieArtwork(tmdbId: number): Promise<Artwork | null> {
    if (!this.settings.fetchArtwork) return null;

    const artworkIntegration = this.getArtworkIntegration();
    if (!artworkIntegration || !this.isIntegrationReady(artworkIntegration.id)) {
      return null;
    }

    try {
      return await artworkIntegration.getMovieArtwork(tmdbId);
    } catch (error) {
      console.error('Error fetching movie artwork:', error);
      return null;
    }
  }

  /**
   * Fetch artwork for a TV show from Fanart.tv (if enabled)
   */
  async fetchShowArtwork(tvdbId: number): Promise<Artwork | null> {
    if (!this.settings.fetchArtwork) return null;

    const artworkIntegration = this.getArtworkIntegration();
    if (!artworkIntegration || !this.isIntegrationReady(artworkIntegration.id)) {
      return null;
    }

    try {
      return await artworkIntegration.getShowArtwork(tvdbId);
    } catch (error) {
      console.error('Error fetching show artwork:', error);
      return null;
    }
  }

  /**
   * Fetch aggregate ratings from MDBList (if enabled)
   */
  async fetchMovieRatings(imdbId: string): Promise<AggregateRatings | null> {
    if (!this.settings.fetchRatings) return null;

    const ratingsIntegration = this.getRatingsIntegration();
    if (!ratingsIntegration || !this.isIntegrationReady(ratingsIntegration.id)) {
      return null;
    }

    try {
      return await ratingsIntegration.getMovieRatings(imdbId);
    } catch (error) {
      console.error('Error fetching movie ratings:', error);
      return null;
    }
  }

  /**
   * Fetch aggregate ratings for a TV show from MDBList (if enabled)
   */
  async fetchShowRatings(imdbId: string): Promise<AggregateRatings | null> {
    if (!this.settings.fetchRatings) return null;

    const ratingsIntegration = this.getRatingsIntegration();
    if (!ratingsIntegration || !this.isIntegrationReady(ratingsIntegration.id)) {
      return null;
    }

    try {
      return await ratingsIntegration.getShowRatings(imdbId);
    } catch (error) {
      console.error('Error fetching show ratings:', error);
      return null;
    }
  }

  /**
   * Orchestrate complete movie metadata fetch
   * 1. Search and match
   * 2. Fetch full details
   * 3. Fetch artwork (if enabled)
   * 4. Fetch ratings (if enabled)
   */
  async fetchCompleteMovieMetadata(
    title: string,
    year?: number
  ): Promise<{
    match: ScoredSearchResult | null;
    details: MovieDetails | null;
    artwork: Artwork | null;
    ratings: AggregateRatings | null;
    result: MatchResult;
  }> {
    const usedIntegrations: string[] = [];

    // Step 1: Find best match
    const match = await this.findBestMovieMatch(title, year);
    if (!match) {
      return {
        match: null,
        details: null,
        artwork: null,
        ratings: null,
        result: {
          matched: false,
          confidence: 0,
          integrations: [],
        },
      };
    }

    usedIntegrations.push(match.integration);

    // Step 2: Fetch full details
    const details = await this.fetchMovieDetails(
      match.integration,
      match.integrationId
    );

    if (!details) {
      return {
        match,
        details: null,
        artwork: null,
        ratings: null,
        result: {
          matched: false,
          confidence: match.confidence,
          integrations: usedIntegrations,
          error: 'Failed to fetch movie details',
        },
      };
    }

    // Step 3: Fetch artwork
    let artwork: Artwork | null = null;
    if (details.externalIds.tmdb) {
      artwork = await this.fetchMovieArtwork(details.externalIds.tmdb);
      if (artwork) {
        const artworkIntegration = this.getArtworkIntegration();
        if (artworkIntegration) {
          usedIntegrations.push(artworkIntegration.id);
        }
      }
    }

    // Step 4: Fetch ratings
    let ratings: AggregateRatings | null = null;
    if (details.externalIds.imdb) {
      ratings = await this.fetchMovieRatings(details.externalIds.imdb);
      if (ratings) {
        const ratingsIntegration = this.getRatingsIntegration();
        if (ratingsIntegration) {
          usedIntegrations.push(ratingsIntegration.id);
        }
      }
    }

    return {
      match,
      details,
      artwork,
      ratings,
      result: {
        matched: true,
        confidence: match.confidence,
        integrations: usedIntegrations,
      },
    };
  }

  /**
   * Orchestrate complete TV show metadata fetch
   */
  async fetchCompleteShowMetadata(
    title: string,
    year?: number
  ): Promise<{
    match: ScoredSearchResult | null;
    details: ShowDetails | null;
    artwork: Artwork | null;
    ratings: AggregateRatings | null;
    result: MatchResult;
  }> {
    const usedIntegrations: string[] = [];

    // Step 1: Find best match
    const match = await this.findBestShowMatch(title, year);
    if (!match) {
      return {
        match: null,
        details: null,
        artwork: null,
        ratings: null,
        result: {
          matched: false,
          confidence: 0,
          integrations: [],
        },
      };
    }

    usedIntegrations.push(match.integration);

    // Step 2: Fetch full details
    const details = await this.fetchShowDetails(
      match.integration,
      match.integrationId
    );

    if (!details) {
      return {
        match,
        details: null,
        artwork: null,
        ratings: null,
        result: {
          matched: false,
          confidence: match.confidence,
          integrations: usedIntegrations,
          error: 'Failed to fetch show details',
        },
      };
    }

    // Step 3: Fetch artwork
    let artwork: Artwork | null = null;
    if (details.externalIds.tvdb) {
      artwork = await this.fetchShowArtwork(details.externalIds.tvdb);
      if (artwork) {
        const artworkIntegration = this.getArtworkIntegration();
        if (artworkIntegration) {
          usedIntegrations.push(artworkIntegration.id);
        }
      }
    }

    // Step 4: Fetch ratings
    let ratings: AggregateRatings | null = null;
    if (details.externalIds.imdb) {
      ratings = await this.fetchShowRatings(details.externalIds.imdb);
      if (ratings) {
        const ratingsIntegration = this.getRatingsIntegration();
        if (ratingsIntegration) {
          usedIntegrations.push(ratingsIntegration.id);
        }
      }
    }

    return {
      match,
      details,
      artwork,
      ratings,
      result: {
        matched: true,
        confidence: match.confidence,
        integrations: usedIntegrations,
      },
    };
  }
}

/**
 * Create default metadata settings
 */
export function createDefaultMetadataSettings(): MetadataSettings {
  return {
    integrations: {},
    movieIntegrations: ['tmdb', 'omdb'],
    tvIntegrations: ['tmdb', 'tvdb'],
    animeIntegrations: ['anilist', 'anidb', 'mal'],
    autoMatchThreshold: DEFAULT_MATCHER_CONFIG.autoMatchThreshold,
    fetchArtwork: true,
    fetchRatings: true,
    language: 'en-US',
    enabledRatingSources: [
      'imdb',
      'tmdb',
      'rottenTomatoesCritics',
      'rottenTomatoesAudience',
      'metacritic',
    ],
  };
}

