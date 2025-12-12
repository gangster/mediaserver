/**
 * Title matching algorithm for high-accuracy metadata matching
 */

import type { SearchResult, ScoredSearchResult } from './types.js';

/**
 * Normalize a title for comparison
 * - Converts to lowercase
 * - Removes "the", "a", "an" articles
 * - Removes year suffixes like "(2021)"
 * - Removes special characters
 * - Normalizes whitespace
 */
export function normalizeTitle(title: string): string {
  let normalized = title
    .toLowerCase()
    // Remove year in parentheses at the end
    .replace(/\s*\(\d{4}\)\s*$/, '')
    // Remove year at the end without parentheses
    .replace(/\s+\d{4}\s*$/, '')
    // Remove special characters except spaces
    .replace(/[^\w\s]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Remove articles at the start (after whitespace normalization)
  normalized = normalized.replace(/^(the|a|an)\s+/, '');

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= b.length; j++) {
    matrix[0]![j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1, // deletion
        matrix[i]![j - 1]! + 1, // insertion
        matrix[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  return matrix[a.length]![b.length]!;
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
export function stringSimilarity(a: string, b: string): number {
  const normalizedA = normalizeTitle(a);
  const normalizedB = normalizeTitle(b);

  if (normalizedA === normalizedB) {
    return 1;
  }

  if (normalizedA.length === 0 || normalizedB.length === 0) {
    return 0;
  }

  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);

  return 1 - distance / maxLength;
}

/**
 * Extract year from a release date string
 */
export function extractYear(dateString?: string): number | undefined {
  if (!dateString) return undefined;

  const match = dateString.match(/(\d{4})/);
  return match ? parseInt(match[1]!, 10) : undefined;
}

/**
 * Calculate year match score
 * Returns 1.0 for exact match, 0.8 for +/- 1 year, 0.5 for +/- 2 years, 0 otherwise
 */
export function yearMatchScore(
  sourceYear: number | undefined,
  targetYear: number | undefined
): number {
  if (sourceYear === undefined || targetYear === undefined) {
    // If either year is missing, return a neutral score
    return 0.7;
  }

  const diff = Math.abs(sourceYear - targetYear);

  if (diff === 0) return 1.0;
  if (diff === 1) return 0.8;
  if (diff === 2) return 0.5;
  return 0;
}

/**
 * Calculate confidence score for a match
 *
 * @param sourceTitle - Title from the file/folder
 * @param sourceYear - Year from the file/folder (if available)
 * @param targetTitle - Title from the search result
 * @param targetReleaseDate - Release date from the search result
 * @returns Confidence score from 0 to 1
 */
export function calculateConfidence(
  sourceTitle: string,
  sourceYear: number | undefined,
  targetTitle: string,
  targetReleaseDate?: string
): number {
  // Calculate title similarity (0-1)
  const titleSimilarity = stringSimilarity(sourceTitle, targetTitle);

  // Calculate year score (0-1)
  const targetYear = extractYear(targetReleaseDate);
  const yearScore = yearMatchScore(sourceYear, targetYear);

  // Weighted combination
  // Title is most important (70%), year is secondary (30%)
  const confidence = titleSimilarity * 0.7 + yearScore * 0.3;

  // Bonus for exact normalized title match
  if (normalizeTitle(sourceTitle) === normalizeTitle(targetTitle)) {
    return Math.min(1, confidence + 0.1);
  }

  return confidence;
}

/**
 * Score search results by confidence
 */
export function scoreSearchResults(
  sourceTitle: string,
  sourceYear: number | undefined,
  results: SearchResult[]
): ScoredSearchResult[] {
  return results
    .map((result) => ({
      ...result,
      confidence: calculateConfidence(
        sourceTitle,
        sourceYear,
        result.title,
        result.releaseDate
      ),
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Find best match from search results
 *
 * @param sourceTitle - Title to match
 * @param sourceYear - Year to match (optional)
 * @param results - Search results from integration
 * @param threshold - Minimum confidence threshold (default 0.85)
 * @returns Best match if above threshold, null otherwise
 */
export function findBestMatch(
  sourceTitle: string,
  sourceYear: number | undefined,
  results: SearchResult[],
  threshold: number = 0.85
): ScoredSearchResult | null {
  if (results.length === 0) {
    return null;
  }

  const scored = scoreSearchResults(sourceTitle, sourceYear, results);
  const best = scored[0];

  if (best && best.confidence >= threshold) {
    return best;
  }

  return null;
}

/**
 * Configuration options for the matcher
 */
export interface MatcherConfig {
  /** Minimum confidence score for auto-match (0-1) */
  autoMatchThreshold: number;
  /** Weight for title similarity (0-1) */
  titleWeight: number;
  /** Weight for year matching (0-1) */
  yearWeight: number;
}

/**
 * Default matcher configuration
 */
export const DEFAULT_MATCHER_CONFIG: MatcherConfig = {
  autoMatchThreshold: 0.85,
  titleWeight: 0.7,
  yearWeight: 0.3,
};

