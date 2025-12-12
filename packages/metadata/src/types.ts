/**
 * Core types for the metadata pipeline
 */

// =============================================================================
// External IDs
// =============================================================================

export interface ExternalIds {
  tmdb?: number;
  tvdb?: number;
  imdb?: string;
  anidb?: number;
  anilist?: number;
  mal?: number;
  trakt?: number;
}

// =============================================================================
// Search Results
// =============================================================================

export interface SearchResult {
  /** Integration that provided this result */
  integration: string;
  /** ID within the integration (e.g., TMDB ID) */
  integrationId: string;
  /** Title of the media */
  title: string;
  /** Original title (if different) */
  originalTitle?: string;
  /** Release year */
  year?: number;
  /** Release/air date */
  releaseDate?: string;
  /** Short overview/description */
  overview?: string;
  /** Poster image path (integration-specific) */
  posterPath?: string;
  /** Backdrop image path */
  backdropPath?: string;
  /** Media type */
  mediaType: 'movie' | 'tvshow';
  /** Popularity score from the integration */
  popularity?: number;
  /** Vote average from the integration */
  voteAverage?: number;
}

export interface ScoredSearchResult extends SearchResult {
  /** Confidence score from matching algorithm (0-1) */
  confidence: number;
}

// =============================================================================
// Movie Details
// =============================================================================

export interface MovieDetails {
  /** External IDs from various integrations */
  externalIds: ExternalIds;
  /** Movie title */
  title: string;
  /** Original title */
  originalTitle?: string;
  /** Movie tagline */
  tagline?: string;
  /** Plot overview */
  overview?: string;
  /** Release date (ISO format) */
  releaseDate?: string;
  /** Runtime in minutes */
  runtime?: number;
  /** Vote average (0-10) */
  voteAverage?: number;
  /** Vote count */
  voteCount?: number;
  /** Popularity score */
  popularity?: number;
  /** Production status */
  status?: string;
  /** Poster path */
  posterPath?: string;
  /** Backdrop path */
  backdropPath?: string;
  /** Logo path */
  logoPath?: string;
  /** Genres */
  genres: Genre[];
  /** Cast members */
  cast: CastMember[];
  /** Crew members */
  crew: CrewMember[];
  /** Content ratings by country */
  contentRatings: ContentRating[];
  /** Trailers/videos */
  trailers: Trailer[];
  /** Production companies */
  productionCompanies?: ProductionCompany[];
  /** Production countries */
  productionCountries?: string[];
  /** Spoken languages */
  spokenLanguages?: string[];
  /** Budget in USD */
  budget?: number;
  /** Revenue in USD */
  revenue?: number;
  /** Homepage URL */
  homepage?: string;
}

// =============================================================================
// TV Show Details
// =============================================================================

export interface ShowDetails {
  /** External IDs from various integrations */
  externalIds: ExternalIds;
  /** Show title */
  title: string;
  /** Original title */
  originalTitle?: string;
  /** Show tagline */
  tagline?: string;
  /** Plot overview */
  overview?: string;
  /** First air date (ISO format) */
  firstAirDate?: string;
  /** Last air date */
  lastAirDate?: string;
  /** Episode runtime in minutes */
  episodeRuntime?: number[];
  /** Vote average (0-10) */
  voteAverage?: number;
  /** Vote count */
  voteCount?: number;
  /** Popularity score */
  popularity?: number;
  /** Show status (Returning Series, Ended, etc.) */
  status?: string;
  /** Show type (Scripted, Reality, etc.) */
  type?: string;
  /** Poster path */
  posterPath?: string;
  /** Backdrop path */
  backdropPath?: string;
  /** Logo path */
  logoPath?: string;
  /** Genres */
  genres: Genre[];
  /** Cast members */
  cast: CastMember[];
  /** Crew members (creators, etc.) */
  crew: CrewMember[];
  /** Content ratings by country */
  contentRatings: ContentRating[];
  /** Trailers/videos */
  trailers: Trailer[];
  /** Networks */
  networks?: Network[];
  /** Production companies */
  productionCompanies?: ProductionCompany[];
  /** Number of seasons */
  numberOfSeasons?: number;
  /** Number of episodes */
  numberOfEpisodes?: number;
  /** Seasons info */
  seasons: SeasonInfo[];
  /** Origin country */
  originCountry?: string[];
  /** Original language */
  originalLanguage?: string;
  /** Homepage URL */
  homepage?: string;
  /** Created by (show creators) */
  createdBy?: Person[];
}

export interface SeasonInfo {
  /** Season number (0 for specials) */
  seasonNumber: number;
  /** Season name */
  name?: string;
  /** Season overview */
  overview?: string;
  /** Air date */
  airDate?: string;
  /** Poster path */
  posterPath?: string;
  /** Episode count */
  episodeCount?: number;
  /** Vote average */
  voteAverage?: number;
}

export interface SeasonDetails extends SeasonInfo {
  /** External IDs */
  externalIds: ExternalIds;
  /** Episodes in this season */
  episodes: EpisodeDetails[];
}

export interface EpisodeDetails {
  /** External IDs */
  externalIds: ExternalIds;
  /** Season number */
  seasonNumber: number;
  /** Episode number */
  episodeNumber: number;
  /** Episode title */
  title: string;
  /** Episode overview */
  overview?: string;
  /** Air date */
  airDate?: string;
  /** Runtime in minutes */
  runtime?: number;
  /** Still image path */
  stillPath?: string;
  /** Vote average */
  voteAverage?: number;
  /** Vote count */
  voteCount?: number;
  /** Production code */
  productionCode?: string;
  /** Guest stars */
  guestStars?: CastMember[];
  /** Crew for this episode */
  crew?: CrewMember[];
}

// =============================================================================
// People & Credits
// =============================================================================

export interface Person {
  /** Person ID from integration */
  id: string;
  /** Person name */
  name: string;
  /** Profile image path */
  profilePath?: string;
  /** External IDs */
  externalIds?: ExternalIds;
}

export interface CastMember extends Person {
  /** Character name */
  character: string;
  /** Order in credits */
  order: number;
}

export interface CrewMember extends Person {
  /** Department (Directing, Writing, etc.) */
  department: string;
  /** Job title (Director, Writer, etc.) */
  job: string;
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface Genre {
  /** Genre ID from integration */
  id: number;
  /** Genre name */
  name: string;
}

export interface ContentRating {
  /** Country code (US, GB, etc.) */
  country: string;
  /** Rating (PG-13, TV-MA, etc.) */
  rating: string;
}

export interface Trailer {
  /** Video ID (e.g., YouTube video ID) */
  key: string;
  /** Video name/title */
  name: string;
  /** Video site (YouTube, Vimeo) */
  site: string;
  /** Video type (Trailer, Teaser, Featurette) */
  type: string;
  /** Is official trailer */
  official: boolean;
  /** Published date */
  publishedAt?: string;
}

export interface Network {
  /** Network ID */
  id: number;
  /** Network name */
  name: string;
  /** Logo path */
  logoPath?: string;
  /** Origin country */
  originCountry?: string;
}

export interface ProductionCompany {
  /** Company ID */
  id: number;
  /** Company name */
  name: string;
  /** Logo path */
  logoPath?: string;
  /** Origin country */
  originCountry?: string;
}

// =============================================================================
// Artwork (Fanart.tv)
// =============================================================================

export interface Artwork {
  /** Movie/show posters */
  posters?: ArtworkImage[];
  /** Backdrops/fanart */
  backdrops?: ArtworkImage[];
  /** Clear logos */
  logos?: ArtworkImage[];
  /** Clear art */
  clearArt?: ArtworkImage[];
  /** Disc art */
  discArt?: ArtworkImage[];
  /** Banners */
  banners?: ArtworkImage[];
  /** Thumbs */
  thumbs?: ArtworkImage[];
  /** Season posters (keyed by season number) */
  seasonPosters?: Record<number, ArtworkImage[]>;
  /** Season banners */
  seasonBanners?: Record<number, ArtworkImage[]>;
  /** Season thumbs */
  seasonThumbs?: Record<number, ArtworkImage[]>;
}

export interface ArtworkImage {
  /** Image URL */
  url: string;
  /** Language code */
  language?: string;
  /** Like count (for sorting) */
  likes?: number;
}

// =============================================================================
// Aggregate Ratings (MDBList)
// =============================================================================

export interface AggregateRatings {
  /** IMDB rating (0-10) */
  imdb?: RatingScore;
  /** TMDB rating (0-10) */
  tmdb?: RatingScore;
  /** Rotten Tomatoes critics score (0-100) */
  rottenTomatoesCritics?: RatingScore;
  /** Rotten Tomatoes audience score (0-100) */
  rottenTomatoesAudience?: RatingScore;
  /** Metacritic score (0-100) */
  metacritic?: RatingScore;
  /** Letterboxd rating (0-5) */
  letterboxd?: RatingScore;
  /** Trakt rating (0-10) */
  trakt?: RatingScore;
}

export interface RatingScore {
  /** Score value */
  score: number;
  /** Number of votes */
  voteCount?: number;
}

// =============================================================================
// Watch History (Trakt)
// =============================================================================

export interface WatchHistory {
  /** Movies watched */
  movies: WatchedMovie[];
  /** Shows watched */
  shows: WatchedShow[];
}

export interface WatchedMovie {
  /** External IDs */
  externalIds: ExternalIds;
  /** Title */
  title: string;
  /** Year */
  year?: number;
  /** When it was watched */
  watchedAt: string;
  /** Number of times watched */
  plays: number;
}

export interface WatchedShow {
  /** External IDs */
  externalIds: ExternalIds;
  /** Title */
  title: string;
  /** Year */
  year?: number;
  /** Episodes watched */
  episodes: WatchedEpisode[];
}

export interface WatchedEpisode {
  /** Season number */
  seasonNumber: number;
  /** Episode number */
  episodeNumber: number;
  /** When it was watched */
  watchedAt: string;
  /** Number of times watched */
  plays: number;
}

// =============================================================================
// Integration Configuration
// =============================================================================

export interface IntegrationConfig {
  /** Integration ID */
  id: string;
  /** Display name */
  name: string;
  /** Is enabled */
  enabled: boolean;
  /** API key (if required) */
  apiKey?: string;
  /** OAuth tokens (for Trakt) */
  tokens?: OAuthTokens;
  /** Additional config options */
  options?: Record<string, unknown>;
}

export interface OAuthTokens {
  /** Access token */
  accessToken: string;
  /** Refresh token */
  refreshToken: string;
  /** Token expiry (ISO date) */
  expiresAt: string;
}

// =============================================================================
// Metadata Settings
// =============================================================================

export interface MetadataSettings {
  /** Integration configurations */
  integrations: Record<string, IntegrationConfig>;
  /** Movie integration priority order */
  movieIntegrations: string[];
  /** TV integration priority order */
  tvIntegrations: string[];
  /** Anime integration priority order */
  animeIntegrations: string[];
  /** Auto-match confidence threshold (0-1) */
  autoMatchThreshold: number;
  /** Whether to fetch artwork from Fanart.tv */
  fetchArtwork: boolean;
  /** Whether to fetch aggregate ratings from MDBList */
  fetchRatings: boolean;
  /** Preferred metadata language */
  language: string;
  /** Enabled rating sources to display */
  enabledRatingSources: string[];
}

// =============================================================================
// Match Status
// =============================================================================

export type MatchStatus = 'pending' | 'matched' | 'unmatched' | 'ignored';

export interface MatchResult {
  /** Whether a match was found */
  matched: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Integrations used */
  integrations: string[];
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Watch History (Sync Integrations)
// =============================================================================

export interface WatchHistoryItem {
  /** Media type */
  mediaType: 'movie' | 'episode';
  /** TMDB ID */
  tmdbId: number;
  /** Show TMDB ID (for episodes) */
  showTmdbId?: number;
  /** Season number (for episodes) */
  seasonNumber?: number;
  /** Episode number (for episodes) */
  episodeNumber?: number;
  /** When watched */
  watchedAt: string;
  /** Progress percentage (0-100) */
  progress?: number;
}

