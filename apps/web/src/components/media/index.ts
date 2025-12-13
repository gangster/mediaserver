/**
 * Media components index
 *
 * Re-exports components from @mediaserver/ui and web-specific wrappers.
 */

// Re-export shared components from UI package
export {
  MediaCard,
  EpisodeCard,
  CastCard,
  MediaRow,
  HeroBanner,
  MediaGrid,
  SimpleMediaGrid,
  SkeletonMediaCard,
  type MediaCardProps,
  type MediaCardSize,
  type EpisodeCardProps,
  type CastCardProps,
  type MediaRowProps,
  type MediaRowItem,
  type HeroBannerProps,
  type MediaGridProps,
  type MediaGridItem,
} from '@mediaserver/ui';

// Web-specific wrappers with responsive behaviors
export {
  WebMediaRow,
  type WebMediaRowProps,
} from './WebMediaRow';

export {
  WebHeroBanner,
  WebHeroBannerSkeleton,
  type WebHeroBannerProps,
  type BannerItem,
} from './WebHeroBanner';

// Browse page components
export {
  MovieCard,
  MovieCardSkeleton,
  type MovieItem,
  type MovieCardProps,
} from './cards';

export {
  ShowCard,
  ShowCardSkeleton,
  type ShowItem,
  type ShowCardProps,
} from './cards';

export {
  MediaToolbar,
  type MediaToolbarProps,
  type FilterOption,
} from './toolbar';

export {
  MediaGrid as BrowseMediaGrid,
  type MediaGridProps as BrowseMediaGridProps,
} from './grid';

// Ratings components
export {
  RatingBadge,
  MultiRating,
  LegacyRating,
  type RatingData,
  type RatingSource,
} from './ratings';

// Technical details
export { TechnicalDetails } from './details';

// Metadata source selector
export { MetadataSourceSelector, type ProviderMetadataResult, type ProductionCompany } from './MetadataSourceSelector';

// Refresh metadata button
export { RefreshMetadataButton } from './RefreshMetadataButton';

// Cast and crew sections
export { CastSection, GuestStarsSection } from './CastSection';
export type { CastMember, CrewMember, GuestStar } from './CastSection';
