/**
 * Spacing scale for consistent layout.
 *
 * Based on a 4px base unit.
 */

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
  36: 144,
  40: 160,
  44: 176,
  48: 192,
  52: 208,
  56: 224,
  60: 240,
  64: 256,
  72: 288,
  80: 320,
  96: 384,
} as const;

/** Type for spacing values */
export type SpacingKey = keyof typeof spacing;
export type SpacingValue = (typeof spacing)[SpacingKey];

/**
 * Border radius scale.
 */
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

/** Type for border radius values */
export type BorderRadiusKey = keyof typeof borderRadius;

/**
 * Touch target sizes.
 * Minimum sizes for interactive elements.
 */
export const touchTarget = {
  /** Minimum for mobile (44x44 as per Apple HIG) */
  mobile: 44,
  /** Minimum for TV (larger for D-pad navigation) */
  tv: 80,
  /** Default icon button size */
  iconButton: 40,
  /** Large button height */
  buttonLarge: 48,
  /** Default button height */
  button: 40,
  /** Small button height */
  buttonSmall: 32,
} as const;

/**
 * Safe area margins for TV.
 * 5% on all sides as recommended for 10-foot UI.
 */
export const tvSafeArea = {
  horizontal: '5%',
  vertical: '5%',
} as const;

/**
 * Z-index scale for layering.
 */
export const zIndex = {
  hide: -1,
  base: 0,
  raised: 1,
  dropdown: 10,
  sticky: 100,
  overlay: 200,
  modal: 300,
  popover: 400,
  toast: 500,
  tooltip: 600,
  maximum: 9999,
} as const;

