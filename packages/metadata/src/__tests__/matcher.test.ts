/**
 * Tests for the title matching algorithm
 */

import { describe, test, expect } from 'vitest';
import {
  normalizeTitle,
  stringSimilarity,
  levenshteinDistance,
  calculateConfidence,
  yearMatchScore,
  extractYear,
  findBestMatch,
  scoreSearchResults,
} from '../matcher.js';
import type { SearchResult } from '../types.js';

describe('normalizeTitle', () => {
  test('converts to lowercase', () => {
    expect(normalizeTitle('The Matrix')).toBe('matrix');
  });

  test('removes "The" prefix', () => {
    expect(normalizeTitle('The Matrix')).toBe('matrix');
    expect(normalizeTitle('THE SHAWSHANK REDEMPTION')).toBe('shawshank redemption');
  });

  test('removes "A" prefix', () => {
    expect(normalizeTitle('A Beautiful Mind')).toBe('beautiful mind');
  });

  test('removes "An" prefix', () => {
    expect(normalizeTitle('An American Werewolf in London')).toBe(
      'american werewolf in london'
    );
  });

  test('removes year suffix in parentheses', () => {
    expect(normalizeTitle('Dune (2021)')).toBe('dune');
    expect(normalizeTitle('Blade Runner (1982)')).toBe('blade runner');
  });

  test('removes year suffix without parentheses', () => {
    expect(normalizeTitle('Dune 2021')).toBe('dune');
  });

  test('handles special characters', () => {
    expect(normalizeTitle("Ocean's Eleven")).toBe('oceans eleven');
    expect(normalizeTitle('Spider-Man: No Way Home')).toBe('spiderman no way home');
  });

  test('normalizes whitespace', () => {
    expect(normalizeTitle('  The   Matrix   ')).toBe('matrix');
  });

  test('handles empty string', () => {
    expect(normalizeTitle('')).toBe('');
  });
});

describe('levenshteinDistance', () => {
  test('returns 0 for identical strings', () => {
    expect(levenshteinDistance('matrix', 'matrix')).toBe(0);
  });

  test('returns correct distance for single character difference', () => {
    expect(levenshteinDistance('matrix', 'matrx')).toBe(1);
    expect(levenshteinDistance('matrix', 'matrixx')).toBe(1);
  });

  test('returns string length for completely different strings', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });

  test('handles empty strings', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
    expect(levenshteinDistance('', '')).toBe(0);
  });
});

describe('stringSimilarity', () => {
  test('returns 1.0 for identical titles after normalization', () => {
    expect(stringSimilarity('The Matrix', 'the matrix')).toBe(1);
    expect(stringSimilarity('The Matrix', 'Matrix')).toBe(1);
  });

  test('returns high similarity for similar titles', () => {
    const similarity = stringSimilarity('The Matrix', 'The Matrx');
    expect(similarity).toBeGreaterThan(0.8);
  });

  test('returns low similarity for different titles', () => {
    const similarity = stringSimilarity('The Matrix', 'Avatar');
    expect(similarity).toBeLessThan(0.5);
  });

  test('returns 0 for empty strings', () => {
    expect(stringSimilarity('', 'abc')).toBe(0);
    expect(stringSimilarity('abc', '')).toBe(0);
  });
});

describe('extractYear', () => {
  test('extracts year from ISO date', () => {
    expect(extractYear('1999-03-31')).toBe(1999);
    expect(extractYear('2021-10-22')).toBe(2021);
  });

  test('extracts year from year-only string', () => {
    expect(extractYear('1999')).toBe(1999);
  });

  test('returns undefined for invalid input', () => {
    expect(extractYear(undefined)).toBeUndefined();
    expect(extractYear('')).toBeUndefined();
    expect(extractYear('invalid')).toBeUndefined();
  });
});

describe('yearMatchScore', () => {
  test('returns 1.0 for exact match', () => {
    expect(yearMatchScore(1999, 1999)).toBe(1.0);
  });

  test('returns 0.8 for +/- 1 year', () => {
    expect(yearMatchScore(1999, 2000)).toBe(0.8);
    expect(yearMatchScore(2000, 1999)).toBe(0.8);
  });

  test('returns 0.5 for +/- 2 years', () => {
    expect(yearMatchScore(1999, 2001)).toBe(0.5);
    expect(yearMatchScore(2001, 1999)).toBe(0.5);
  });

  test('returns 0 for larger differences', () => {
    expect(yearMatchScore(1999, 2005)).toBe(0);
  });

  test('returns 0.7 when either year is undefined', () => {
    expect(yearMatchScore(undefined, 1999)).toBe(0.7);
    expect(yearMatchScore(1999, undefined)).toBe(0.7);
    expect(yearMatchScore(undefined, undefined)).toBe(0.7);
  });
});

describe('calculateConfidence', () => {
  test('returns 1.0 for exact match with year', () => {
    const confidence = calculateConfidence('The Matrix', 1999, 'The Matrix', '1999-03-31');
    expect(confidence).toBe(1.0);
  });

  test('returns high confidence for exact title without year', () => {
    const confidence = calculateConfidence(
      'The Matrix',
      undefined,
      'The Matrix',
      '1999-03-31'
    );
    expect(confidence).toBeGreaterThanOrEqual(0.8);
  });

  test('returns high confidence for fuzzy match with typo', () => {
    const confidence = calculateConfidence('The Matrx', 1999, 'The Matrix', '1999-03-31');
    expect(confidence).toBeGreaterThan(0.7);
  });

  test('returns low confidence for completely different titles', () => {
    const confidence = calculateConfidence('Avatar', 2009, 'The Matrix', '1999-03-31');
    expect(confidence).toBeLessThan(0.5);
  });

  test('penalizes year mismatch', () => {
    const exactYear = calculateConfidence('Dune', 2021, 'Dune', '2021-10-22');
    const wrongYear = calculateConfidence('Dune', 1984, 'Dune', '2021-10-22');
    expect(exactYear).toBeGreaterThan(wrongYear);
  });
});

describe('scoreSearchResults', () => {
  const mockResults: SearchResult[] = [
    {
      integration: 'tmdb',
      integrationId: '603',
      title: 'The Matrix',
      year: 1999,
      releaseDate: '1999-03-31',
      mediaType: 'movie',
    },
    {
      integration: 'tmdb',
      integrationId: '604',
      title: 'The Matrix Reloaded',
      year: 2003,
      releaseDate: '2003-05-15',
      mediaType: 'movie',
    },
    {
      integration: 'tmdb',
      integrationId: '605',
      title: 'The Matrix Revolutions',
      year: 2003,
      releaseDate: '2003-11-05',
      mediaType: 'movie',
    },
  ];

  test('sorts results by confidence descending', () => {
    const scored = scoreSearchResults('The Matrix', 1999, mockResults);

    expect(scored[0]?.title).toBe('The Matrix');
    expect(scored[0]?.confidence).toBeGreaterThan(scored[1]?.confidence ?? 0);
  });

  test('adds confidence property to results', () => {
    const scored = scoreSearchResults('The Matrix', 1999, mockResults);

    for (const result of scored) {
      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('findBestMatch', () => {
  const mockResults: SearchResult[] = [
    {
      integration: 'tmdb',
      integrationId: '603',
      title: 'The Matrix',
      year: 1999,
      releaseDate: '1999-03-31',
      mediaType: 'movie',
    },
    {
      integration: 'tmdb',
      integrationId: '999',
      title: 'Some Other Movie',
      year: 2020,
      releaseDate: '2020-01-01',
      mediaType: 'movie',
    },
  ];

  test('returns best match when above threshold', () => {
    const match = findBestMatch('The Matrix', 1999, mockResults, 0.85);

    expect(match).not.toBeNull();
    expect(match?.title).toBe('The Matrix');
    expect(match?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  test('returns null when no match above threshold', () => {
    const match = findBestMatch('Completely Different', 2022, mockResults, 0.85);

    expect(match).toBeNull();
  });

  test('returns null for empty results', () => {
    const match = findBestMatch('The Matrix', 1999, [], 0.85);

    expect(match).toBeNull();
  });

  test('respects custom threshold', () => {
    const highThreshold = findBestMatch('The Matrx', 1999, mockResults, 0.99);
    const lowThreshold = findBestMatch('The Matrx', 1999, mockResults, 0.5);

    expect(highThreshold).toBeNull();
    expect(lowThreshold).not.toBeNull();
  });
});


