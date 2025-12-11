/**
 * Color palette for the design system.
 *
 * Uses a dark theme optimized for media viewing.
 * Colors are designed for high contrast and accessibility.
 */

export const colors = {
  // Backgrounds
  background: '#0a0a0f', // Deep Space - primary background
  card: '#18181b', // Slate - card backgrounds
  elevated: '#27272a', // Zinc - elevated surfaces
  border: '#27272a', // Zinc - borders, dividers

  // Primary accent (Indigo)
  primary: '#6366f1',
  primaryHover: '#818cf8',
  primaryActive: '#4f46e5',
  primaryMuted: '#312e81',

  // Secondary accent (Slate)
  secondary: '#64748b',
  secondaryHover: '#94a3b8',
  secondaryActive: '#475569',

  // Semantic colors
  success: '#22c55e',
  successMuted: '#166534',
  warning: '#f59e0b',
  warningMuted: '#92400e',
  error: '#ef4444',
  errorMuted: '#991b1b',
  info: '#3b82f6',
  infoMuted: '#1e40af',

  // AI-specific features (Purple)
  ai: '#a855f7',
  aiHover: '#c084fc',
  aiActive: '#9333ea',
  aiMuted: '#581c87',

  // Premium indicator (Gold)
  premium: '#eab308',
  premiumMuted: '#854d0e',

  // Text colors
  text: '#fafafa', // Primary text
  textSecondary: '#a1a1aa', // Secondary text
  textMuted: '#71717a', // Muted text
  textDisabled: '#52525b', // Disabled text

  // Interactive states
  focus: '#6366f1', // Focus ring
  focusRing: 'rgba(99, 102, 241, 0.5)',
  overlay: 'rgba(0, 0, 0, 0.75)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',

  // Specific use cases
  player: {
    background: '#000000',
    controls: 'rgba(0, 0, 0, 0.8)',
    progress: '#6366f1',
    buffer: 'rgba(99, 102, 241, 0.3)',
  },

  // Rating colors (for different sources)
  ratings: {
    imdb: '#f5c518',
    rottenTomatoes: '#fa320a',
    metacritic: '#ffcc33',
    letterboxd: '#00c030',
    trakt: '#ed1c24',
  },
} as const;

/** Type for the colors object */
export type Colors = typeof colors;

/** Color scale for consistent shading */
export const colorScale = {
  zinc: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#09090b',
  },
  indigo: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7c3aed',
    800: '#6b21a8',
    900: '#581c87',
    950: '#3b0764',
  },
} as const;

