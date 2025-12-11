/**
 * ESLint configuration for mediaserver monorepo.
 *
 * Uses TypeScript ESLint for type-aware linting.
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // TypeScript handles these
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],

    // Allow explicit any in some cases (we use @ts-expect-error for API client)
    '@typescript-eslint/no-explicit-any': 'warn',

    // Consistency
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],

    // Allow empty functions for placeholders
    '@typescript-eslint/no-empty-function': 'off',

    // Prefer const
    'prefer-const': 'error',

    // No console in production code (warn only)
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Enforce consistent return
    'consistent-return': 'off',

    // Allow non-null assertions (we use them carefully)
    '@typescript-eslint/no-non-null-assertion': 'off',
  },
  overrides: [
    // React/React Native files
    {
      files: ['*.tsx'],
      plugins: ['react', 'react-hooks'],
      extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended'],
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        // React 17+ doesn't need import React
        'react/react-in-jsx-scope': 'off',
        // We use TypeScript for prop validation
        'react/prop-types': 'off',
        // Allow spreading props
        'react/jsx-props-no-spreading': 'off',
      },
    },
    // Test files
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
    // Config files
    {
      files: ['*.config.ts', '*.config.js', '*.config.cjs'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.expo/',
    '.turbo/',
    'coverage/',
    '*.d.ts',
  ],
};

