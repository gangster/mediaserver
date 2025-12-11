/**
 * Combined theme object.
 */

import { colors, colorScale } from './colors.js';
import { spacing, borderRadius, touchTarget, tvSafeArea, zIndex } from './spacing.js';
import { fontFamily, fontWeight, fontSize, tvFontSize, letterSpacing, textStyles } from './typography.js';

/**
 * Complete theme object containing all design tokens.
 */
export const theme = {
  colors,
  colorScale,
  spacing,
  borderRadius,
  touchTarget,
  tvSafeArea,
  zIndex,
  fontFamily,
  fontWeight,
  fontSize,
  tvFontSize,
  letterSpacing,
  textStyles,
} as const;

/** Type for the complete theme */
export type Theme = typeof theme;

