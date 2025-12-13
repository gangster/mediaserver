/**
 * TVDb API response types
 */

/** TVDb series search result */
export interface TvdbSearchResult {
  objectID: string;
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  first_air_time?: string;
  overview?: string;
  type: string;
  tvdb_id: string;
  year?: string;
  network?: string;
  status?: string;
  remote_ids?: TvdbRemoteId[];
}

/** TVDb remote ID (external provider mapping) */
export interface TvdbRemoteId {
  id: string;
  type: number;
  sourceName: string;
}

/** TVDb series details */
export interface TvdbSeries {
  id: number;
  name: string;
  slug: string;
  image?: string;
  firstAired?: string;
  lastAired?: string;
  nextAired?: string;
  score?: number;
  status?: {
    id: number;
    name: string;
    recordType: string;
    keepUpdated: boolean;
  };
  originalCountry?: string;
  originalLanguage?: string;
  defaultSeasonType?: number;
  isOrderRandomized?: boolean;
  lastUpdated?: string;
  averageRuntime?: number;
  episodes?: TvdbEpisode[];
  overview?: string;
  year?: string;
  artworks?: TvdbArtwork[];
  genres?: TvdbGenre[];
  remoteIds?: TvdbRemoteId[];
  originalNetwork?: TvdbNetwork;
  seasons?: TvdbSeason[];
}

/** TVDb episode */
export interface TvdbEpisode {
  id: number;
  seriesId: number;
  name?: string;
  aired?: string;
  runtime?: number;
  overview?: string;
  image?: string;
  imageType?: number;
  isMovie?: number;
  seasons?: TvdbSeasonReference[];
  number?: number;
  seasonNumber?: number;
  lastUpdated?: string;
  finaleType?: string;
  airsBeforeSeason?: number;
  airsBeforeEpisode?: number;
  airsAfterSeason?: number;
  year?: string;
}

/** TVDb season */
export interface TvdbSeason {
  id: number;
  seriesId: number;
  type?: {
    id: number;
    name: string;
    type: string;
  };
  number: number;
  name?: string;
  image?: string;
  imageType?: number;
  lastUpdated?: string;
  year?: string;
}

/** TVDb season reference in episode */
export interface TvdbSeasonReference {
  id: number;
  number: number;
}

/** TVDb artwork */
export interface TvdbArtwork {
  id: number;
  image: string;
  thumbnail: string;
  language?: string;
  type: number;
  score?: number;
  width?: number;
  height?: number;
}

/** TVDb genre */
export interface TvdbGenre {
  id: number;
  name: string;
  slug: string;
}

/** TVDb network */
export interface TvdbNetwork {
  id: number;
  name: string;
  slug: string;
  country: string;
}

/** TVDb API response wrapper */
export interface TvdbResponse<T> {
  status: string;
  data: T;
}

/** Remote ID type constants */
export const REMOTE_ID_TYPES = {
  IMDB: 2,
  TMDB: 12,
  ANIDB: 4,
  ANILIST: 9,
} as const;

/** Artwork type constants */
export const ARTWORK_TYPES = {
  BANNER: 1,
  POSTER: 2,
  BACKGROUND: 3,
  ICON: 5,
} as const;

