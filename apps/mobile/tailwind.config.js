/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    '../../packages/ui/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        background: '#0a0a0f',
        card: '#18181b',
        elevated: '#27272a',
        border: '#27272a',

        // Primary accent (Indigo)
        primary: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          active: '#4f46e5',
          muted: '#312e81',
        },

        // Secondary
        secondary: {
          DEFAULT: '#64748b',
          hover: '#94a3b8',
          active: '#475569',
        },

        // Semantic
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',

        // AI accent
        ai: {
          DEFAULT: '#a855f7',
          hover: '#c084fc',
          active: '#9333ea',
          muted: '#581c87',
        },

        // Premium
        premium: '#eab308',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};

