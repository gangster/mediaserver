/**
 * TMDB Integration - Primary metadata source for movies and TV shows
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
  CastMember,
  CrewMember,
  ContentRating,
  Trailer,
  SeasonInfo,
} from '../../types.js';
import { TmdbClient } from './client.js';
import type {
  TmdbMovieDetails,
  TmdbTvDetails,
  TmdbSeasonDetails as TmdbSeasonDetailsResponse,
  TmdbEpisode,
  TmdbCastMember,
  TmdbCrewMember,
  TmdbVideo,
} from './types.js';

/**
 * TMDB Integration
 */
export class TmdbIntegration implements MetadataIntegration {
  readonly id = 'tmdb';
  readonly name = 'The Movie Database';
  readonly description = 'Primary metadata source for movies and TV shows';
  readonly apiKeyUrl = 'https://www.themoviedb.org/settings/api';
  readonly requiresApiKey = true;
  readonly usesOAuth = false;
  readonly providesMetadata = true;
  readonly supportsMovies = true;
  readonly supportsShows = true;
  readonly supportsAnime = true;
  readonly ratingSources = ['tmdb'];

  private client: TmdbClient | null = null;
  private config: IntegrationConfig | null = null;

  async initialize(config: IntegrationConfig): Promise<void> {
    this.config = config;

    if (config.enabled && config.apiKey) {
      this.client = new TmdbClient({
        apiKey: config.apiKey,
        language: (config.options?.language as string) ?? 'en-US',
      });
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Client not initialized' };
    }
    return this.client.testConnection();
  }

  isReady(): boolean {
    return this.client !== null && this.config?.enabled === true;
  }

  async searchMovies(query: string, year?: number): Promise<SearchResult[]> {
    if (!this.client) {
      throw new Error('TMDB client not initialized');
    }

    const response = await this.client.searchMovies(query, { year });

    return response.results.map((movie) => ({
      integration: this.id,
      integrationId: String(movie.id),
      title: movie.title,
      originalTitle: movie.original_title,
      year: movie.release_date ? parseInt(movie.release_date.substring(0, 4), 10) : undefined,
      releaseDate: movie.release_date,
      overview: movie.overview,
      posterPath: movie.poster_path ?? undefined,
      backdropPath: movie.backdrop_path ?? undefined,
      mediaType: 'movie' as const,
      popularity: movie.popularity,
      voteAverage: movie.vote_average,
    }));
  }

  async searchShows(query: string, year?: number): Promise<SearchResult[]> {
    if (!this.client) {
      throw new Error('TMDB client not initialized');
    }

    const response = await this.client.searchTv(query, { firstAirDateYear: year });

    return response.results.map((show) => ({
      integration: this.id,
      integrationId: String(show.id),
      title: show.name,
      originalTitle: show.original_name,
      year: show.first_air_date ? parseInt(show.first_air_date.substring(0, 4), 10) : undefined,
      releaseDate: show.first_air_date,
      overview: show.overview,
      posterPath: show.poster_path ?? undefined,
      backdropPath: show.backdrop_path ?? undefined,
      mediaType: 'tvshow' as const,
      popularity: show.popularity,
      voteAverage: show.vote_average,
    }));
  }

  async getMovieDetails(integrationId: string): Promise<MovieDetails> {
    if (!this.client) {
      throw new Error('TMDB client not initialized');
    }

    const movie = await this.client.getMovieDetails(parseInt(integrationId, 10));
    return this.transformMovieDetails(movie);
  }

  async getShowDetails(integrationId: string): Promise<ShowDetails> {
    if (!this.client) {
      throw new Error('TMDB client not initialized');
    }

    const show = await this.client.getTvDetails(parseInt(integrationId, 10));
    return this.transformShowDetails(show);
  }

  async getSeasonDetails(showId: string, seasonNumber: number): Promise<SeasonDetails> {
    if (!this.client) {
      throw new Error('TMDB client not initialized');
    }

    const season = await this.client.getSeasonDetails(parseInt(showId, 10), seasonNumber);
    return this.transformSeasonDetails(season);
  }

  async getEpisodeDetails(
    showId: string,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<EpisodeDetails> {
    if (!this.client) {
      throw new Error('TMDB client not initialized');
    }

    const episode = await this.client.getEpisodeDetails(
      parseInt(showId, 10),
      seasonNumber,
      episodeNumber
    );
    return this.transformEpisodeDetails(episode);
  }

  // ==========================================================================
  // Transform helpers
  // ==========================================================================

  private transformMovieDetails(movie: TmdbMovieDetails): MovieDetails {
    return {
      externalIds: {
        tmdb: movie.id,
        imdb: movie.imdb_id ?? undefined,
        tvdb: movie.external_ids?.tvdb_id ?? undefined,
      },
      title: movie.title,
      originalTitle: movie.original_title,
      tagline: movie.tagline ?? undefined,
      overview: movie.overview ?? undefined,
      releaseDate: movie.release_date,
      runtime: movie.runtime ?? undefined,
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      popularity: movie.popularity,
      status: movie.status,
      posterPath: movie.poster_path ?? undefined,
      backdropPath: movie.backdrop_path ?? undefined,
      logoPath: movie.images?.logos?.[0]?.file_path,
      genres: this.transformGenres(movie.genres),
      cast: this.transformCast(movie.credits?.cast ?? []),
      crew: this.transformCrew(movie.credits?.crew ?? []),
      contentRatings: this.transformMovieContentRatings(movie),
      trailers: this.transformVideos(movie.videos?.results ?? []),
      productionCompanies: movie.production_companies.map((c) => ({
        id: c.id,
        name: c.name,
        logoPath: c.logo_path ?? undefined,
        originCountry: c.origin_country,
      })),
      productionCountries: movie.production_countries.map((c) => c.iso_3166_1),
      spokenLanguages: movie.spoken_languages.map((l) => l.iso_639_1),
      budget: movie.budget || undefined,
      revenue: movie.revenue || undefined,
      homepage: movie.homepage ?? undefined,
    };
  }

  private transformShowDetails(show: TmdbTvDetails): ShowDetails {
    return {
      externalIds: {
        tmdb: show.id,
        imdb: show.external_ids?.imdb_id ?? undefined,
        tvdb: show.external_ids?.tvdb_id ?? undefined,
      },
      title: show.name,
      originalTitle: show.original_name,
      tagline: show.tagline ?? undefined,
      overview: show.overview ?? undefined,
      firstAirDate: show.first_air_date,
      lastAirDate: show.last_air_date ?? undefined,
      episodeRuntime: show.episode_run_time,
      voteAverage: show.vote_average,
      voteCount: show.vote_count,
      popularity: show.popularity,
      status: show.status,
      type: show.type,
      posterPath: show.poster_path ?? undefined,
      backdropPath: show.backdrop_path ?? undefined,
      logoPath: show.images?.logos?.[0]?.file_path,
      genres: this.transformGenres(show.genres),
      cast: this.transformCast(show.credits?.cast ?? []),
      crew: this.transformCrew(show.credits?.crew ?? []),
      contentRatings: this.transformShowContentRatings(show),
      trailers: this.transformVideos(show.videos?.results ?? []),
      networks: show.networks.map((n) => ({
        id: n.id,
        name: n.name,
        logoPath: n.logo_path ?? undefined,
        originCountry: n.origin_country,
      })),
      productionCompanies: show.production_companies.map((c) => ({
        id: c.id,
        name: c.name,
        logoPath: c.logo_path ?? undefined,
        originCountry: c.origin_country,
      })),
      numberOfSeasons: show.number_of_seasons,
      numberOfEpisodes: show.number_of_episodes,
      seasons: show.seasons.map((s) => this.transformSeasonInfo(s)),
      originCountry: show.origin_country,
      originalLanguage: show.original_language,
      homepage: show.homepage ?? undefined,
      createdBy: show.created_by.map((c) => ({
        id: String(c.id),
        name: c.name,
        profilePath: c.profile_path ?? undefined,
      })),
    };
  }

  private transformSeasonInfo(season: {
    id: number;
    season_number: number;
    name: string;
    overview: string | null;
    air_date: string | null;
    poster_path: string | null;
    episode_count: number;
    vote_average: number;
  }): SeasonInfo {
    return {
      seasonNumber: season.season_number,
      name: season.name,
      overview: season.overview ?? undefined,
      airDate: season.air_date ?? undefined,
      posterPath: season.poster_path ?? undefined,
      episodeCount: season.episode_count,
      voteAverage: season.vote_average,
    };
  }

  private transformSeasonDetails(season: TmdbSeasonDetailsResponse): SeasonDetails {
    return {
      externalIds: {
        tmdb: season.id,
        tvdb: season.external_ids?.tvdb_id ?? undefined,
      },
      seasonNumber: season.season_number,
      name: season.name,
      overview: season.overview ?? undefined,
      airDate: season.air_date ?? undefined,
      posterPath: season.poster_path ?? undefined,
      episodeCount: season.episode_count,
      voteAverage: season.vote_average,
      episodes: season.episodes.map((e) => this.transformEpisodeDetails(e)),
    };
  }

  private transformEpisodeDetails(episode: TmdbEpisode): EpisodeDetails {
    return {
      externalIds: {
        tmdb: episode.id,
      },
      seasonNumber: episode.season_number,
      episodeNumber: episode.episode_number,
      title: episode.name,
      overview: episode.overview ?? undefined,
      airDate: episode.air_date ?? undefined,
      runtime: episode.runtime ?? undefined,
      stillPath: episode.still_path ?? undefined,
      voteAverage: episode.vote_average,
      voteCount: episode.vote_count,
      productionCode: episode.production_code ?? undefined,
      guestStars: episode.guest_stars?.map((g) => this.transformCastMember(g)),
      crew: episode.crew?.map((c) => this.transformCrewMember(c)),
    };
  }

  private transformGenres(genres: { id: number; name: string }[]): Genre[] {
    return genres.map((g) => ({ id: g.id, name: g.name }));
  }

  private transformCast(cast: TmdbCastMember[]): CastMember[] {
    return cast.slice(0, 20).map((c) => this.transformCastMember(c));
  }

  private transformCastMember(c: TmdbCastMember): CastMember {
    return {
      id: String(c.id),
      name: c.name,
      profilePath: c.profile_path ?? undefined,
      character: c.character,
      order: c.order,
    };
  }

  private transformCrew(crew: TmdbCrewMember[]): CrewMember[] {
    // Filter to key crew members (directors, writers, etc.)
    const keyJobs = ['Director', 'Writer', 'Screenplay', 'Story', 'Creator', 'Executive Producer', 'Producer', 'Director of Photography', 'Original Music Composer'];
    return crew
      .filter((c) => keyJobs.includes(c.job))
      .slice(0, 15)
      .map((c) => this.transformCrewMember(c));
  }

  private transformCrewMember(c: TmdbCrewMember): CrewMember {
    return {
      id: String(c.id),
      name: c.name,
      profilePath: c.profile_path ?? undefined,
      department: c.department,
      job: c.job,
    };
  }

  private transformMovieContentRatings(movie: TmdbMovieDetails): ContentRating[] {
    if (!movie.release_dates?.results) return [];

    const ratings: ContentRating[] = [];
    for (const result of movie.release_dates.results) {
      // Get the first certification for each country
      const certification = result.release_dates.find((r) => r.certification);
      if (certification?.certification) {
        ratings.push({
          country: result.iso_3166_1,
          rating: certification.certification,
        });
      }
    }
    return ratings;
  }

  private transformShowContentRatings(show: TmdbTvDetails): ContentRating[] {
    if (!show.content_ratings?.results) return [];

    return show.content_ratings.results.map((r) => ({
      country: r.iso_3166_1,
      rating: r.rating,
    }));
  }

  private transformVideos(videos: TmdbVideo[]): Trailer[] {
    return videos
      .filter((v) => v.site === 'YouTube' && ['Trailer', 'Teaser', 'Featurette'].includes(v.type))
      .slice(0, 10)
      .map((v) => ({
        key: v.key,
        name: v.name,
        site: v.site,
        type: v.type,
        official: v.official,
        publishedAt: v.published_at,
      }));
  }
}

// Export the client for direct use if needed
export { TmdbClient, TmdbRateLimitError, TmdbApiError } from './client.js';
export type { TmdbClientConfig } from './client.js';

