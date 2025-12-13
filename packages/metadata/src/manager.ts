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
  ExternalIds,
} from './types.js';
import { scoreSearchResults, findBestMatch, DEFAULT_MATCHER_CONFIG } from './matcher.js';

/**
 * Result from fetching metadata from all providers.
 * Contains metadata keyed by provider ID.
 */
export interface MultiProviderMetadataResult<T> {
  /** The best match found during search */
  match: ScoredSearchResult | null;
  /** Metadata from each provider that successfully returned data */
  providerData: Record<string, T>;
  /** Artwork from Fanart.tv (if enabled) */
  artwork: Artwork | null;
  /** Aggregate ratings from MDBList (if enabled) */
  ratings: AggregateRatings | null;
  /** Overall match result */
  result: MatchResult;
  /** External IDs collected from all providers */
  externalIds: ExternalIds;
}

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
   * 3. Supplement missing metadata from fallback providers
   * 4. Fetch artwork (if enabled)
   * 5. Fetch ratings (if enabled)
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
    let details = await this.fetchMovieDetails(
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

    // Step 3: Supplement missing metadata from fallback providers
    details = await this.supplementMovieDetails(details, match.integration, usedIntegrations);

    // Step 4: Fetch artwork
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

    // Step 5: Fetch ratings
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
   * Fetch movie metadata from ALL configured providers.
   * 
   * This is the new multi-provider approach that caches metadata from every
   * enabled provider, enabling instant provider switching in the UI.
   * 
   * Flow:
   * 1. Search and find best match to get initial external IDs
   * 2. Fetch details from ALL providers in parallel using cross-referenced IDs
   * 3. Merge external IDs from all providers to build complete ID map
   * 4. Fetch artwork and ratings
   * 
   * @param title Movie title to search for
   * @param year Optional release year for better matching
   * @returns Metadata from all providers that successfully returned data
   */
  async fetchAllMovieProviderMetadata(
    title: string,
    year?: number
  ): Promise<MultiProviderMetadataResult<MovieDetails>> {
    const usedIntegrations: string[] = [];

    // Step 1: Find best match to get initial external IDs
    const match = await this.findBestMovieMatch(title, year);
    if (!match) {
      return {
        match: null,
        providerData: {},
        artwork: null,
        ratings: null,
        externalIds: {},
        result: {
          matched: false,
          confidence: 0,
          integrations: [],
        },
      };
    }

    usedIntegrations.push(match.integration);

    // Step 2: Fetch initial details from the matched provider to get external IDs
    const initialDetails = await this.fetchMovieDetails(
      match.integration,
      match.integrationId
    );

    if (!initialDetails) {
      return {
        match,
        providerData: {},
        artwork: null,
        ratings: null,
        externalIds: {},
        result: {
          matched: false,
          confidence: match.confidence,
          integrations: usedIntegrations,
          error: 'Failed to fetch initial movie details',
        },
      };
    }

    // Build initial external IDs from the matched provider
    let externalIds: ExternalIds = { ...initialDetails.externalIds };
    
    // Store all provider data keyed by provider ID
    const providerData: Record<string, MovieDetails> = {
      [match.integration]: initialDetails,
    };

    // Step 3: Fetch from ALL other enabled providers in parallel
    const otherProviders = this.settings.movieIntegrations.filter(
      (id) => id !== match.integration && this.isIntegrationReady(id)
    );

    const fetchPromises = otherProviders.map(async (integrationId) => {
      const integration = this.getIntegration<MetadataIntegration>(integrationId);
      if (!integration || !isMetadataIntegration(integration)) {
        return { integrationId, details: null };
      }

      try {
        // Try to find external ID for this provider
        const externalId = this.getMovieExternalIdForIntegration(externalIds, integrationId);
        if (!externalId) {
          return { integrationId, details: null };
        }

        const details = await integration.getMovieDetails(externalId);
        return { integrationId, details };
      } catch (error) {
        console.error(`Error fetching movie metadata from ${integrationId}:`, error);
        return { integrationId, details: null };
      }
    });

    const results = await Promise.all(fetchPromises);

    // Process results and merge external IDs
    for (const { integrationId, details } of results) {
      if (details) {
        providerData[integrationId] = details;
        usedIntegrations.push(integrationId);

        // Merge external IDs from this provider
        externalIds = this.mergeExternalIds(externalIds, details.externalIds);
      }
    }

    // Step 4: Now that we have more external IDs, try fetching from providers we might have missed
    const missingProviders = this.settings.movieIntegrations.filter(
      (id) => !providerData[id] && this.isIntegrationReady(id)
    );

    if (missingProviders.length > 0) {
      const secondPassPromises = missingProviders.map(async (integrationId) => {
        const integration = this.getIntegration<MetadataIntegration>(integrationId);
        if (!integration || !isMetadataIntegration(integration)) {
          return { integrationId, details: null };
        }

        try {
          const externalId = this.getMovieExternalIdForIntegration(externalIds, integrationId);
          if (!externalId) {
            return { integrationId, details: null };
          }

          const details = await integration.getMovieDetails(externalId);
          return { integrationId, details };
        } catch (error) {
          console.error(`Error fetching movie metadata from ${integrationId} (second pass):`, error);
          return { integrationId, details: null };
        }
      });

      const secondPassResults = await Promise.all(secondPassPromises);

      for (const { integrationId, details } of secondPassResults) {
        if (details) {
          providerData[integrationId] = details;
          usedIntegrations.push(integrationId);
          externalIds = this.mergeExternalIds(externalIds, details.externalIds);
        }
      }
    }

    // Step 5: Fetch artwork (if enabled)
    let artwork: Artwork | null = null;
    if (externalIds.tmdb) {
      artwork = await this.fetchMovieArtwork(externalIds.tmdb);
      if (artwork) {
        const artworkIntegration = this.getArtworkIntegration();
        if (artworkIntegration) {
          usedIntegrations.push(artworkIntegration.id);
        }
      }
    }

    // Step 6: Fetch ratings (if enabled)
    let ratings: AggregateRatings | null = null;
    if (externalIds.imdb) {
      ratings = await this.fetchMovieRatings(externalIds.imdb);
      if (ratings) {
        const ratingsIntegration = this.getRatingsIntegration();
        if (ratingsIntegration) {
          usedIntegrations.push(ratingsIntegration.id);
        }
      }
    }

    return {
      match,
      providerData,
      artwork,
      ratings,
      externalIds,
      result: {
        matched: true,
        confidence: match.confidence,
        integrations: [...new Set(usedIntegrations)], // Dedupe
      },
    };
  }

  /**
   * Fetch show metadata from ALL configured providers.
   * 
   * This is the new multi-provider approach that caches metadata from every
   * enabled provider, enabling instant provider switching in the UI.
   */
  async fetchAllShowProviderMetadata(
    title: string,
    year?: number
  ): Promise<MultiProviderMetadataResult<ShowDetails>> {
    const usedIntegrations: string[] = [];

    // Step 1: Find best match to get initial external IDs
    const match = await this.findBestShowMatch(title, year);
    if (!match) {
      return {
        match: null,
        providerData: {},
        artwork: null,
        ratings: null,
        externalIds: {},
        result: {
          matched: false,
          confidence: 0,
          integrations: [],
        },
      };
    }

    usedIntegrations.push(match.integration);

    // Step 2: Fetch initial details from the matched provider
    const initialDetails = await this.fetchShowDetails(
      match.integration,
      match.integrationId
    );

    if (!initialDetails) {
      return {
        match,
        providerData: {},
        artwork: null,
        ratings: null,
        externalIds: {},
        result: {
          matched: false,
          confidence: match.confidence,
          integrations: usedIntegrations,
          error: 'Failed to fetch initial show details',
        },
      };
    }

    // Build initial external IDs
    let externalIds: ExternalIds = { ...initialDetails.externalIds };
    
    const providerData: Record<string, ShowDetails> = {
      [match.integration]: initialDetails,
    };

    // Step 3: Fetch from ALL other enabled providers in parallel
    const otherProviders = this.settings.tvIntegrations.filter(
      (id) => id !== match.integration && this.isIntegrationReady(id)
    );

    const fetchPromises = otherProviders.map(async (integrationId) => {
      const integration = this.getIntegration<MetadataIntegration>(integrationId);
      if (!integration || !isMetadataIntegration(integration)) {
        return { integrationId, details: null };
      }

      try {
        const externalId = this.getExternalIdForIntegration(externalIds, integrationId);
        if (!externalId) {
          return { integrationId, details: null };
        }

        const details = await integration.getShowDetails(externalId);
        return { integrationId, details };
      } catch (error) {
        console.error(`Error fetching show metadata from ${integrationId}:`, error);
        return { integrationId, details: null };
      }
    });

    const results = await Promise.all(fetchPromises);

    for (const { integrationId, details } of results) {
      if (details) {
        providerData[integrationId] = details;
        usedIntegrations.push(integrationId);
        externalIds = this.mergeExternalIds(externalIds, details.externalIds);
      }
    }

    // Step 4: Second pass for providers we might have missed
    const missingProviders = this.settings.tvIntegrations.filter(
      (id) => !providerData[id] && this.isIntegrationReady(id)
    );

    if (missingProviders.length > 0) {
      const secondPassPromises = missingProviders.map(async (integrationId) => {
        const integration = this.getIntegration<MetadataIntegration>(integrationId);
        if (!integration || !isMetadataIntegration(integration)) {
          return { integrationId, details: null };
        }

        try {
          const externalId = this.getExternalIdForIntegration(externalIds, integrationId);
          if (!externalId) {
            return { integrationId, details: null };
          }

          const details = await integration.getShowDetails(externalId);
          return { integrationId, details };
        } catch (error) {
          console.error(`Error fetching show metadata from ${integrationId} (second pass):`, error);
          return { integrationId, details: null };
        }
      });

      const secondPassResults = await Promise.all(secondPassPromises);

      for (const { integrationId, details } of secondPassResults) {
        if (details) {
          providerData[integrationId] = details;
          usedIntegrations.push(integrationId);
          externalIds = this.mergeExternalIds(externalIds, details.externalIds);
        }
      }
    }

    // Step 5: Fetch artwork (prefer TVDB for shows)
    let artwork: Artwork | null = null;
    if (externalIds.tvdb) {
      artwork = await this.fetchShowArtwork(externalIds.tvdb);
      if (artwork) {
        const artworkIntegration = this.getArtworkIntegration();
        if (artworkIntegration) {
          usedIntegrations.push(artworkIntegration.id);
        }
      }
    }

    // Step 6: Fetch ratings
    let ratings: AggregateRatings | null = null;
    if (externalIds.imdb) {
      ratings = await this.fetchShowRatings(externalIds.imdb);
      if (ratings) {
        const ratingsIntegration = this.getRatingsIntegration();
        if (ratingsIntegration) {
          usedIntegrations.push(ratingsIntegration.id);
        }
      }
    }

    return {
      match,
      providerData,
      artwork,
      ratings,
      externalIds,
      result: {
        matched: true,
        confidence: match.confidence,
        integrations: [...new Set(usedIntegrations)],
      },
    };
  }

  /**
   * Merge external IDs from multiple sources.
   * Prefers non-null values and keeps existing values if new ones are null.
   */
  private mergeExternalIds(existing: ExternalIds, incoming: ExternalIds): ExternalIds {
    return {
      tmdb: incoming.tmdb ?? existing.tmdb,
      tvdb: incoming.tvdb ?? existing.tvdb,
      imdb: incoming.imdb ?? existing.imdb,
      anidb: incoming.anidb ?? existing.anidb,
      anilist: incoming.anilist ?? existing.anilist,
      mal: incoming.mal ?? existing.mal,
      trakt: incoming.trakt ?? existing.trakt,
    };
  }

  /**
   * Supplement movie details with missing metadata from fallback providers.
   * This fills in gaps (like production company logos) from other providers when the primary doesn't have them.
   * 
   * @deprecated Use fetchAllMovieProviderMetadata instead for new code.
   * This method is kept for backwards compatibility.
   */
  private async supplementMovieDetails(
    details: MovieDetails,
    primaryIntegration: string,
    usedIntegrations: string[]
  ): Promise<MovieDetails> {
    // Check if we need to supplement production company logos
    const needsCompanyLogo = details.productionCompanies?.some(c => !c.logoPath) ?? false;
    
    if (!needsCompanyLogo) {
      return details;
    }

    // Try to get supplementary data from fallback integrations
    for (const integrationId of this.settings.movieIntegrations) {
      // Skip the primary integration we already used
      if (integrationId === primaryIntegration) continue;
      if (!this.isIntegrationReady(integrationId)) continue;

      const integration = this.getIntegration<MetadataIntegration>(integrationId);
      if (!integration || !isMetadataIntegration(integration)) continue;

      try {
        // Get the external ID for this integration
        const externalId = this.getMovieExternalIdForIntegration(details.externalIds, integrationId);
        if (!externalId) continue;

        const fallbackDetails = await integration.getMovieDetails(externalId);
        if (!fallbackDetails) continue;

        // Merge production company logos from fallback provider
        if (fallbackDetails.productionCompanies && fallbackDetails.productionCompanies.length > 0) {
          details = this.mergeCompanyLogos(details, fallbackDetails.productionCompanies);
          
          // Track that we used this integration for supplementary data
          if (!usedIntegrations.includes(integrationId)) {
            usedIntegrations.push(integrationId);
          }
          
          // Check if we still need more data
          const stillNeedsLogo = details.productionCompanies?.some(c => !c.logoPath) ?? false;
          if (!stillNeedsLogo) {
            break; // We've filled all gaps
          }
        }
      } catch (error) {
        console.error(`Error fetching supplementary movie data from ${integrationId}:`, error);
      }
    }

    return details;
  }

  /**
   * Get the external ID for a specific movie integration from the external IDs object.
   */
  private getMovieExternalIdForIntegration(
    externalIds: MovieDetails['externalIds'],
    integrationId: string
  ): string | undefined {
    switch (integrationId) {
      case 'tmdb':
        return externalIds.tmdb ? String(externalIds.tmdb) : undefined;
      case 'imdb':
        return externalIds.imdb;
      default:
        return undefined;
    }
  }

  /**
   * Merge production company logos from fallback data into the primary details.
   */
  private mergeCompanyLogos(
    details: MovieDetails,
    fallbackCompanies: NonNullable<MovieDetails['productionCompanies']>
  ): MovieDetails {
    if (!details.productionCompanies || details.productionCompanies.length === 0) {
      return details;
    }

    // Create a map of company names to logo paths from fallback data
    const logoMap = new Map<string, string>();
    for (const company of fallbackCompanies) {
      if (company.logoPath) {
        logoMap.set(company.name.toLowerCase().trim(), company.logoPath);
      }
    }

    // Update companies with missing logos
    const updatedCompanies = details.productionCompanies.map(company => {
      if (company.logoPath) {
        return company;
      }

      const normalizedName = company.name.toLowerCase().trim();
      const logoPath = logoMap.get(normalizedName);
      
      if (logoPath) {
        return { ...company, logoPath };
      }

      return company;
    });

    return { ...details, productionCompanies: updatedCompanies };
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
    let details = await this.fetchShowDetails(
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

    // Step 3: Supplement missing metadata from fallback providers
    details = await this.supplementShowDetails(details, match.integration, usedIntegrations);

    // Step 4: Fetch artwork
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

    // Step 5: Fetch ratings
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

  /**
   * Supplement show details with missing metadata from fallback providers.
   * This fills in gaps (like network logos) from other providers when the primary doesn't have them.
   */
  private async supplementShowDetails(
    details: ShowDetails,
    primaryIntegration: string,
    usedIntegrations: string[]
  ): Promise<ShowDetails> {
    // Check if we need to supplement network logos
    const needsNetworkLogo = details.networks?.some(n => !n.logoPath) ?? false;
    
    if (!needsNetworkLogo) {
      return details;
    }

    // Try to get supplementary data from fallback integrations
    for (const integrationId of this.settings.tvIntegrations) {
      // Skip the primary integration we already used
      if (integrationId === primaryIntegration) continue;
      if (!this.isIntegrationReady(integrationId)) continue;

      const integration = this.getIntegration<MetadataIntegration>(integrationId);
      if (!integration || !isMetadataIntegration(integration)) continue;

      try {
        // Get the external ID for this integration
        const externalId = this.getExternalIdForIntegration(details.externalIds, integrationId);
        if (!externalId) continue;

        const fallbackDetails = await integration.getShowDetails(externalId);
        if (!fallbackDetails) continue;

        // Merge network logos from fallback provider
        if (fallbackDetails.networks && fallbackDetails.networks.length > 0) {
          details = this.mergeNetworkLogos(details, fallbackDetails.networks);
          
          // Track that we used this integration for supplementary data
          if (!usedIntegrations.includes(integrationId)) {
            usedIntegrations.push(integrationId);
          }
          
          // Check if we still need more data
          const stillNeedsLogo = details.networks?.some(n => !n.logoPath) ?? false;
          if (!stillNeedsLogo) {
            break; // We've filled all gaps
          }
        }
      } catch (error) {
        console.error(`Error fetching supplementary data from ${integrationId}:`, error);
      }
    }

    return details;
  }

  /**
   * Get the external ID for a specific integration from the external IDs object.
   */
  private getExternalIdForIntegration(
    externalIds: ShowDetails['externalIds'],
    integrationId: string
  ): string | undefined {
    switch (integrationId) {
      case 'tmdb':
        return externalIds.tmdb ? String(externalIds.tmdb) : undefined;
      case 'tvdb':
        return externalIds.tvdb ? String(externalIds.tvdb) : undefined;
      case 'imdb':
        return externalIds.imdb;
      default:
        return undefined;
    }
  }

  /**
   * Merge network logos from fallback data into the primary details.
   * Matches networks by name and fills in missing logo paths.
   */
  private mergeNetworkLogos(
    details: ShowDetails,
    fallbackNetworks: NonNullable<ShowDetails['networks']>
  ): ShowDetails {
    if (!details.networks || details.networks.length === 0) {
      return details;
    }

    // Create a map of network names to logo paths from fallback data
    const logoMap = new Map<string, string>();
    for (const network of fallbackNetworks) {
      if (network.logoPath) {
        // Normalize network name for matching (lowercase, trim)
        logoMap.set(network.name.toLowerCase().trim(), network.logoPath);
      }
    }

    // Update networks with missing logos
    const updatedNetworks = details.networks.map(network => {
      if (network.logoPath) {
        return network; // Already has a logo
      }

      // Try to find a matching logo from fallback
      const normalizedName = network.name.toLowerCase().trim();
      const logoPath = logoMap.get(normalizedName);
      
      if (logoPath) {
        return { ...network, logoPath };
      }

      return network;
    });

    return { ...details, networks: updatedNetworks };
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

