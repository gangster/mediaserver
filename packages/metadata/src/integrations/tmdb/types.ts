/**
 * TMDB API response types
 */

// =============================================================================
// Search Results
// =============================================================================

export interface TmdbSearchMovieResponse {
  page: number;
  results: TmdbMovieSearchResult[];
  total_pages: number;
  total_results: number;
}

export interface TmdbMovieSearchResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  genre_ids: number[];
  original_language: string;
  video: boolean;
}

export interface TmdbSearchTvResponse {
  page: number;
  results: TmdbTvSearchResult[];
  total_pages: number;
  total_results: number;
}

export interface TmdbTvSearchResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
}

// =============================================================================
// Movie Details
// =============================================================================

export interface TmdbMovieDetails {
  id: number;
  imdb_id: string | null;
  title: string;
  original_title: string;
  tagline: string | null;
  overview: string | null;
  release_date: string;
  runtime: number | null;
  status: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  poster_path: string | null;
  backdrop_path: string | null;
  budget: number;
  revenue: number;
  homepage: string | null;
  adult: boolean;
  genres: TmdbGenre[];
  production_companies: TmdbProductionCompany[];
  production_countries: TmdbProductionCountry[];
  spoken_languages: TmdbSpokenLanguage[];
  belongs_to_collection: TmdbCollection | null;
  // Appended responses
  credits?: TmdbCredits;
  release_dates?: TmdbReleaseDates;
  videos?: TmdbVideos;
  external_ids?: TmdbExternalIds;
  images?: TmdbImages;
}

// =============================================================================
// TV Show Details
// =============================================================================

export interface TmdbTvDetails {
  id: number;
  name: string;
  original_name: string;
  tagline: string | null;
  overview: string | null;
  first_air_date: string;
  last_air_date: string | null;
  status: string;
  type: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  poster_path: string | null;
  backdrop_path: string | null;
  homepage: string | null;
  in_production: boolean;
  number_of_episodes: number;
  number_of_seasons: number;
  episode_run_time: number[];
  genres: TmdbGenre[];
  networks: TmdbNetwork[];
  production_companies: TmdbProductionCompany[];
  production_countries: TmdbProductionCountry[];
  spoken_languages: TmdbSpokenLanguage[];
  origin_country: string[];
  original_language: string;
  seasons: TmdbSeason[];
  created_by: TmdbCreator[];
  last_episode_to_air: TmdbEpisode | null;
  next_episode_to_air: TmdbEpisode | null;
  // Appended responses
  credits?: TmdbCredits;
  content_ratings?: TmdbContentRatings;
  videos?: TmdbVideos;
  external_ids?: TmdbExternalIds;
  images?: TmdbImages;
}

export interface TmdbSeason {
  id: number;
  season_number: number;
  name: string;
  overview: string | null;
  air_date: string | null;
  poster_path: string | null;
  episode_count: number;
  vote_average: number;
}

export interface TmdbSeasonDetails extends TmdbSeason {
  episodes: TmdbEpisode[];
  external_ids?: TmdbExternalIds;
}

export interface TmdbEpisode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
  production_code: string | null;
  crew?: TmdbCrewMember[];
  guest_stars?: TmdbCastMember[];
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface TmdbProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface TmdbSpokenLanguage {
  iso_639_1: string;
  name: string;
  english_name: string;
}

export interface TmdbNetwork {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface TmdbCollection {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
}

export interface TmdbCreator {
  id: number;
  name: string;
  profile_path: string | null;
  credit_id: string;
  gender: number;
}

// =============================================================================
// Credits
// =============================================================================

export interface TmdbCredits {
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}

export interface TmdbCastMember {
  id: number;
  name: string;
  original_name: string;
  profile_path: string | null;
  character: string;
  order: number;
  credit_id: string;
  adult: boolean;
  gender: number;
  known_for_department: string;
  popularity: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  original_name: string;
  profile_path: string | null;
  department: string;
  job: string;
  credit_id: string;
  adult: boolean;
  gender: number;
  known_for_department: string;
  popularity: number;
}

// =============================================================================
// Release Dates / Content Ratings
// =============================================================================

export interface TmdbReleaseDates {
  results: TmdbReleaseDate[];
}

export interface TmdbReleaseDate {
  iso_3166_1: string;
  release_dates: {
    certification: string;
    iso_639_1: string;
    note: string;
    release_date: string;
    type: number;
  }[];
}

export interface TmdbContentRatings {
  results: TmdbContentRating[];
}

export interface TmdbContentRating {
  iso_3166_1: string;
  rating: string;
}

// =============================================================================
// Videos
// =============================================================================

export interface TmdbVideos {
  results: TmdbVideo[];
}

export interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
  iso_639_1: string;
  iso_3166_1: string;
  size: number;
}

// =============================================================================
// External IDs
// =============================================================================

export interface TmdbExternalIds {
  imdb_id: string | null;
  tvdb_id: number | null;
  facebook_id: string | null;
  instagram_id: string | null;
  twitter_id: string | null;
  wikidata_id: string | null;
  freebase_mid?: string | null;
  freebase_id?: string | null;
}

// =============================================================================
// Images
// =============================================================================

export interface TmdbImages {
  backdrops: TmdbImage[];
  posters: TmdbImage[];
  logos: TmdbImage[];
}

export interface TmdbImage {
  aspect_ratio: number;
  file_path: string;
  height: number;
  width: number;
  iso_639_1: string | null;
  vote_average: number;
  vote_count: number;
}

