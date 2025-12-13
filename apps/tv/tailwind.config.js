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
        background: '#09090b',
        surface: '#18181b',
        primary: '#f97316',
        secondary: '#6366f1',
        error: '#ef4444',
        success: '#22c55e',
        warning: '#eab308',
      },
    },
  },
  plugins: [],
};


