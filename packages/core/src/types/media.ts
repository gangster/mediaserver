/**
 * Media-related types (movies, TV shows, episodes).
 */

import type { ContentRating, ISODateString, UUID } from './common.js';

/** Media types */
export type MediaType = 'movie' | 'episode';

/** Extended media types (includes shows) */
export type ExtendedMediaType = 'movie' | 'tvshow' | 'episode';

/** Match status for library items */
export type MatchStatus = 'pending' | 'matched' | 'unmatched' | 'manual';

/** Video resolution */
export type Resolution = '4K' | '1080p' | '720p' | '480p' | 'SD' | 'unknown';

/** Media stream information */
export interface MediaStream {
  index: number;
  type: 'video' | 'audio' | 'subtitle' | 'attachment';
  codec: string;
  codecLongName?: string;
  language?: string;
  title?: string;
  isDefault?: boolean;
  // Video specific
  width?: number;
  height?: number;
  frameRate?: number;
  profile?: string;
  level?: number;
  pixelFormat?: string;
  colorSpace?: string;
  hdr?: boolean;
  // Audio specific
  channels?: number;
  channelLayout?: string;
  sampleRate?: number;
  // Subtitle specific
  forced?: boolean;
  hearingImpaired?: boolean;
}

/** Base media item properties */
interface BaseMediaItem {
  id: UUID;
  title: string;
  sortTitle?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  posterBlurhash?: string;
  backdropBlurhash?: string;
  voteAverage?: number;
  voteCount?: number;
  genres?: string[];
  addedAt: ISODateString;
  updatedAt: ISODateString;
}

/** Movie entity */
export interface Movie extends BaseMediaItem {
  libraryId: UUID;
  filePath: string;
  year?: number;
  tmdbId?: number;
  imdbId?: string;
  tagline?: string;
  releaseDate?: string;
  runtime?: number;
  contentRating?: ContentRating;
  duration?: number;
  videoCodec?: string;
  audioCodec?: string;
  resolution?: Resolution;
  mediaStreams?: MediaStream[];
  directPlayable: boolean;
  needsTranscode: boolean;
  subtitlePaths?: string[];
  matchStatus: MatchStatus;
}

/** Movie summary (for lists) */
export type MovieSummary = Pick<
  Movie,
  | 'id'
  | 'title'
  | 'year'
  | 'posterPath'
  | 'posterBlurhash'
  | 'voteAverage'
  | 'runtime'
  | 'addedAt'
>;

/** TV Show entity */
export interface TVShow extends BaseMediaItem {
  libraryId: UUID;
  folderPath: string;
  year?: number;
  tmdbId?: number;
  imdbId?: string;
  firstAirDate?: string;
  lastAirDate?: string;
  status?: string;
  network?: string;
  contentRating?: ContentRating;
  seasonCount: number;
  episodeCount: number;
  matchStatus: MatchStatus;
}

/** TV Show summary (for lists) */
export type TVShowSummary = Pick<
  TVShow,
  | 'id'
  | 'title'
  | 'year'
  | 'posterPath'
  | 'posterBlurhash'
  | 'voteAverage'
  | 'seasonCount'
  | 'episodeCount'
  | 'status'
  | 'addedAt'
>;

/** Season entity */
export interface Season {
  id: UUID;
  showId: UUID;
  seasonNumber: number;
  tmdbId?: number;
  name?: string;
  overview?: string;
  airDate?: string;
  posterPath?: string;
  posterBlurhash?: string;
  episodeCount: number;
  addedAt: ISODateString;
  updatedAt: ISODateString;
}

/** Episode entity */
export interface Episode {
  id: UUID;
  showId: UUID;
  seasonId: UUID;
  filePath: string;
  seasonNumber: number;
  episodeNumber: number;
  title?: string;
  tmdbId?: number;
  overview?: string;
  airDate?: string;
  runtime?: number;
  stillPath?: string;
  stillBlurhash?: string;
  voteAverage?: number;
  duration?: number;
  videoCodec?: string;
  audioCodec?: string;
  resolution?: Resolution;
  mediaStreams?: MediaStream[];
  directPlayable: boolean;
  needsTranscode: boolean;
  subtitlePaths?: string[];
  addedAt: ISODateString;
  updatedAt: ISODateString;
}

/** Episode summary (for lists) */
export type EpisodeSummary = Pick<
  Episode,
  | 'id'
  | 'showId'
  | 'seasonId'
  | 'seasonNumber'
  | 'episodeNumber'
  | 'title'
  | 'stillPath'
  | 'stillBlurhash'
  | 'runtime'
  | 'airDate'
>;

/** Genre */
export interface Genre {
  id: number;
  name: string;
}

/** Cast member */
export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath?: string;
  order: number;
}

/** Crew member */
export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profilePath?: string;
}

/** Credits (cast and crew) */
export interface Credits {
  cast: CastMember[];
  crew: CrewMember[];
}

/** Movie with full details (including credits) */
export interface MovieDetail extends Movie {
  credits?: Credits;
}

/** TV Show with seasons */
export interface TVShowDetail extends TVShow {
  seasons: Season[];
  credits?: Credits;
}

/** Season with episodes */
export interface SeasonDetail extends Season {
  episodes: Episode[];
}

