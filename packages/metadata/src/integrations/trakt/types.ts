/**
 * Trakt API response types
 */

/** Trakt movie IDs */
export interface TraktMovieIds {
  trakt: number;
  slug: string;
  imdb?: string;
  tmdb?: number;
}

/** Trakt show IDs */
export interface TraktShowIds {
  trakt: number;
  slug: string;
  tvdb?: number;
  imdb?: string;
  tmdb?: number;
}

/** Trakt episode IDs */
export interface TraktEpisodeIds {
  trakt: number;
  tvdb?: number;
  imdb?: string;
  tmdb?: number;
}

/** Trakt movie object */
export interface TraktMovie {
  title: string;
  year?: number;
  ids: TraktMovieIds;
}

/** Trakt show object */
export interface TraktShow {
  title: string;
  year?: number;
  ids: TraktShowIds;
}

/** Trakt episode object */
export interface TraktEpisode {
  season: number;
  number: number;
  title?: string;
  ids: TraktEpisodeIds;
}

/** Trakt watch history item */
export interface TraktHistoryItem {
  id: number;
  watched_at: string;
  action: 'watch' | 'scrobble' | 'checkin';
  type: 'movie' | 'episode';
  movie?: TraktMovie;
  show?: TraktShow;
  episode?: TraktEpisode;
}

/** Trakt playback progress item */
export interface TraktPlaybackItem {
  progress: number;
  paused_at: string;
  id: number;
  type: 'movie' | 'episode';
  movie?: TraktMovie;
  show?: TraktShow;
  episode?: TraktEpisode;
}

/** OAuth token response */
export interface TraktTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  created_at: number;
}

/** Sync history request item */
export interface TraktSyncItem {
  watched_at?: string;
  ids?: {
    trakt?: number;
    imdb?: string;
    tmdb?: number;
    tvdb?: number;
  };
}

/** Sync history request */
export interface TraktSyncHistoryRequest {
  movies?: TraktSyncItem[];
  shows?: TraktSyncItem[];
  episodes?: (TraktSyncItem & { season?: number; episode?: number })[];
}

/** Sync response */
export interface TraktSyncResponse {
  added: {
    movies: number;
    episodes: number;
  };
  not_found: {
    movies: Array<{ ids: Record<string, unknown> }>;
    shows: Array<{ ids: Record<string, unknown> }>;
    episodes: Array<{ ids: Record<string, unknown> }>;
  };
}

/** Scrobble request */
export interface TraktScrobbleRequest {
  movie?: {
    ids: {
      trakt?: number;
      imdb?: string;
      tmdb?: number;
    };
  };
  show?: {
    ids: {
      trakt?: number;
      imdb?: string;
      tmdb?: number;
      tvdb?: number;
    };
  };
  episode?: {
    season: number;
    number: number;
  };
  progress: number;
}

/** Search result wrapper */
export interface TraktSearchResult {
  type: string;
  score: number;
  movie?: TraktMovie;
  show?: TraktShow;
}
