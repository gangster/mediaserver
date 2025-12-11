/**
 * Centralized branding configuration for the entire application.
 * When a final name is chosen, update ONLY these values.
 *
 * Find and replace:
 * - `mediaserver` → `{new-name}`
 * - `@mediaserver/` → `@{new-name}/`
 * - `dev.mediaserver` → `{new-domain}`
 */
export const BRANDING = {
  /** Product name - UPDATE THIS when name is finalized */
  name: 'mediaserver',

  /** npm scope - e.g., @myapp */
  scope: '@mediaserver',

  /** Product tagline */
  tagline: 'Your media. Your AI. Your privacy.',

  /** Alternative taglines for testing */
  alternativeTaglines: [
    'AI-powered. Privacy-protected.',
    'The intelligent media server that respects your privacy.',
    'Smart streaming. Zero tracking.',
  ],

  /** Website and documentation URLs */
  urls: {
    website: 'https://mediaserver.dev',
    docs: 'https://docs.mediaserver.dev',
    github: 'https://github.com/mediaserver/mediaserver',
    support: 'https://mediaserver.dev/support',
  },

  /** App store identifiers */
  ios: {
    bundleId: 'dev.mediaserver.app',
    appStoreId: '', // To be filled when published
  },

  android: {
    packageName: 'dev.mediaserver.app',
  },

  /** TV platform identifiers */
  tv: {
    android: 'dev.mediaserver.tv',
    apple: 'dev.mediaserver.tv',
    fire: 'dev.mediaserver.tv.fire',
  },

  /** Legal and compliance */
  legal: {
    company: 'mediaserver',
    copyright: `© ${new Date().getFullYear()} mediaserver. All rights reserved.`,
    privacyPolicyUrl: 'https://mediaserver.dev/privacy',
    termsOfServiceUrl: 'https://mediaserver.dev/terms',
  },

  /** Social media links */
  social: {
    twitter: '',
    discord: '',
    reddit: '',
  },
} as const;

/** Type for branding configuration */
export type Branding = typeof BRANDING;

