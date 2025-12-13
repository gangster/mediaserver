/**
 * MDBList API response types
 */

/**
 * Individual rating from a source
 */
export interface MdblistRating {
  /** Rating source name */
  source: string;
  /** Rating value (in source's native scale) */
  value: number;
  /** Normalized score 0-100 */
  score: number;
  /** Number of votes */
  votes?: number;
  /** URL to the source page */
  url?: string;
}

/**
 * MDBList media response
 */
export interface MdblistMediaResponse {
  /** Media title */
  title: string;
  /** Release year */
  year: number;
  /** IMDb ID */
  imdbid?: string;
  /** TMDb ID */
  tmdbid?: number;
  /** TVDb ID */
  tvdbid?: number;
  /** Trakt ID */
  traktid?: number;
  /** Media type */
  type: 'movie' | 'show';
  /** Aggregated score (MDBList's own calculation) */
  score?: number;
  /** All ratings from various sources */
  ratings?: MdblistRating[];
  /** Certification/age rating */
  certification?: string;
  /** Runtime in minutes */
  runtime?: number;
  /** Genres */
  genres?: string[];
  /** Plot description */
  description?: string;
  /** Poster URL */
  poster?: string;
  /** Backdrop URL */
  backdrop?: string;
  /** Error message (for not found responses) */
  error?: string;
}

/**
 * MDBList search response
 */
export interface MdblistSearchResponse {
  search: MdblistMediaResponse[];
}

/**
 * Map MDBList source names to standardized rating source IDs
 */
export const MDBLIST_SOURCE_MAP: Record<string, string | null> = {
  imdb: 'imdb',
  tomatoes: 'rt_critics',
  tomatoesaudience: 'rt_audience',
  metacritic: 'metacritic',
  letterboxd: 'letterboxd',
  trakt: 'trakt',
  tmdb: 'tmdb',
  // Sources we don't track
  rogerebert: null,
  myanimelist: null,
};

