/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    '../../packages/ui/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0f',
        surface: '#13131a',
        primary: '#10b981', // emerald-500
        secondary: '#6366f1',
        error: '#ef4444',
        success: '#10b981',
        warning: '#eab308',
      },
    },
  },
  plugins: [],
};

