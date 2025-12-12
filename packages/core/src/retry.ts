/**
 * Retry utilities with exponential backoff for external service calls.
 */

import { sleep } from './utils.js';

/** Configuration for retry behavior */
export interface RetryConfig {
  /** Maximum number of attempts (default: 3) */
  maxAttempts: number;
  /** Initial delay in ms (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in ms (default: 10000) */
  maxDelayMs: number;
  /** Error codes/messages that should trigger retry */
  retryableErrors: string[];
  /** Jitter factor 0-1 for randomizing delay (default: 0.25) */
  jitterFactor?: number;
}

/** Default retry config for external services */
export const EXTERNAL_SERVICE_RETRY: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'rate_limit', '429', '503'],
  jitterFactor: 0.25,
};

/**
 * Calculate delay with exponential backoff and jitter.
 * @param attempt - Current attempt number (1-based)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap
 * @param jitterFactor - Randomization factor (0-1)
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterFactor = 0.25
): number {
  let delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

  if (jitterFactor > 0) {
    const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
    delay = Math.max(0, delay + jitter);
  }

  return Math.round(delay);
}

/**
 * Check if an error should trigger a retry.
 * @param error - The error to check
 * @param retryablePatterns - Array of strings to match against error name/message
 */
export function isRetryableError(error: Error, retryablePatterns: string[]): boolean {
  const errorString = `${error.name} ${error.message}`;
  return retryablePatterns.some((pattern) => errorString.includes(pattern));
}

/** Logger interface for retry operations */
export interface RetryLogger {
  warn(message: string, context?: Record<string, unknown>): void;
}

/**
 * Execute an async operation with retry logic and exponential backoff.
 *
 * @param operation - The async function to execute
 * @param config - Retry configuration
 * @param logger - Optional logger for retry warnings
 * @returns The result of the operation
 * @throws The last error if all retries fail
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   EXTERNAL_SERVICE_RETRY
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = EXTERNAL_SERVICE_RETRY,
  logger?: RetryLogger
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      const shouldRetry = isRetryableError(lastError, config.retryableErrors);

      if (!shouldRetry || attempt === config.maxAttempts) {
        throw lastError;
      }

      const delay = calculateBackoffDelay(
        attempt,
        config.baseDelayMs,
        config.maxDelayMs,
        config.jitterFactor
      );

      logger?.warn('Retrying operation', {
        attempt,
        maxAttempts: config.maxAttempts,
        delay,
        error: lastError.message,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}
