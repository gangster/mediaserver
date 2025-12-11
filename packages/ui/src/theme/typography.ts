/**
 * Typography scale and font settings.
 *
 * Uses system fonts for optimal performance and native feel.
 */

/**
 * Font family definitions.
 * Uses system fonts on each platform.
 */
export const fontFamily = {
  /** System sans-serif (SF Pro on iOS, Roboto on Android) */
  sans: 'System',
  /** Monospace for code */
  mono: 'monospace',
} as const;

/**
 * Font weights.
 */
export const fontWeight = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

/**
 * Font size scale.
 * Each size includes the size and recommended line height.
 */
export const fontSize = {
  xs: {
    size: 12,
    lineHeight: 16,
  },
  sm: {
    size: 14,
    lineHeight: 20,
  },
  base: {
    size: 16,
    lineHeight: 24,
  },
  lg: {
    size: 18,
    lineHeight: 28,
  },
  xl: {
    size: 20,
    lineHeight: 28,
  },
  '2xl': {
    size: 24,
    lineHeight: 32,
  },
  '3xl': {
    size: 30,
    lineHeight: 36,
  },
  '4xl': {
    size: 36,
    lineHeight: 40,
  },
  '5xl': {
    size: 48,
    lineHeight: 48,
  },
  '6xl': {
    size: 60,
    lineHeight: 60,
  },
} as const;

/** Type for font size keys */
export type FontSizeKey = keyof typeof fontSize;

/**
 * TV-specific font sizes (1.5x scale for 10-foot viewing).
 */
export const tvFontSize = {
  xs: {
    size: 18,
    lineHeight: 24,
  },
  sm: {
    size: 21,
    lineHeight: 30,
  },
  base: {
    size: 24,
    lineHeight: 36,
  },
  lg: {
    size: 27,
    lineHeight: 42,
  },
  xl: {
    size: 30,
    lineHeight: 42,
  },
  '2xl': {
    size: 36,
    lineHeight: 48,
  },
  '3xl': {
    size: 45,
    lineHeight: 54,
  },
  '4xl': {
    size: 54,
    lineHeight: 60,
  },
  '5xl': {
    size: 72,
    lineHeight: 72,
  },
  '6xl': {
    size: 90,
    lineHeight: 90,
  },
} as const;

/**
 * Letter spacing (tracking).
 */
export const letterSpacing = {
  tighter: -0.8,
  tight: -0.4,
  normal: 0,
  wide: 0.4,
  wider: 0.8,
  widest: 1.6,
} as const;

/**
 * Pre-defined text styles for common use cases.
 */
export const textStyles = {
  // Headings
  h1: {
    fontSize: fontSize['5xl'].size,
    lineHeight: fontSize['5xl'].lineHeight,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontSize: fontSize['4xl'].size,
    lineHeight: fontSize['4xl'].lineHeight,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
  },
  h3: {
    fontSize: fontSize['3xl'].size,
    lineHeight: fontSize['3xl'].lineHeight,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.normal,
  },
  h4: {
    fontSize: fontSize['2xl'].size,
    lineHeight: fontSize['2xl'].lineHeight,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.normal,
  },
  h5: {
    fontSize: fontSize.xl.size,
    lineHeight: fontSize.xl.lineHeight,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.normal,
  },
  h6: {
    fontSize: fontSize.lg.size,
    lineHeight: fontSize.lg.lineHeight,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.normal,
  },

  // Body text
  bodyLarge: {
    fontSize: fontSize.lg.size,
    lineHeight: fontSize.lg.lineHeight,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  body: {
    fontSize: fontSize.base.size,
    lineHeight: fontSize.base.lineHeight,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  bodySmall: {
    fontSize: fontSize.sm.size,
    lineHeight: fontSize.sm.lineHeight,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.normal,
  },

  // Labels
  label: {
    fontSize: fontSize.sm.size,
    lineHeight: fontSize.sm.lineHeight,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.wide,
  },
  labelSmall: {
    fontSize: fontSize.xs.size,
    lineHeight: fontSize.xs.lineHeight,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.wide,
  },

  // Captions
  caption: {
    fontSize: fontSize.xs.size,
    lineHeight: fontSize.xs.lineHeight,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.normal,
  },

  // Button text
  button: {
    fontSize: fontSize.sm.size,
    lineHeight: fontSize.sm.lineHeight,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wide,
  },
  buttonLarge: {
    fontSize: fontSize.base.size,
    lineHeight: fontSize.base.lineHeight,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wide,
  },
} as const;

/** Type for text style keys */
export type TextStyleKey = keyof typeof textStyles;

