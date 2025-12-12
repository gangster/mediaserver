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
