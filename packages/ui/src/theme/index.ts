/**
 * Theme exports.
 */

export { colors, colorScale } from './colors.js';
export type { Colors } from './colors.js';

export { spacing, borderRadius, touchTarget, tvSafeArea, zIndex } from './spacing.js';
export type { SpacingKey, SpacingValue, BorderRadiusKey } from './spacing.js';

export {
  fontFamily,
  fontWeight,
  fontSize,
  tvFontSize,
  letterSpacing,
  textStyles,
} from './typography.js';
export type { FontSizeKey, TextStyleKey } from './typography.js';

/**
 * Combined theme object for convenience.
 */
export { theme } from './theme.js';

