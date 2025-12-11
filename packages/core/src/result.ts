/**
 * Result type for representing success/failure outcomes.
 * Use this for expected failures that should be handled, not for unexpected errors.
 */

/** A successful result containing a value */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** A failed result containing an error */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/** Result type - either success or failure */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Creates a successful result
 * @param value - The success value
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Creates a failed result
 * @param error - The error value
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard to check if a result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/**
 * Type guard to check if a result is an error
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * Unwraps a successful result, throws if error
 * @throws The error if result is not ok
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwraps a successful result, returns default if error
 * @param result - The result to unwrap
 * @param defaultValue - Value to return if result is an error
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Maps a successful result to a new value
 * @param result - The result to map
 * @param fn - Function to apply to success value
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Maps an error result to a new error
 * @param result - The result to map
 * @param fn - Function to apply to error value
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (!result.ok) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Chains result operations (flatMap)
 * @param result - The result to chain
 * @param fn - Function returning a new result
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Wraps an async function that might throw into a Result
 * @param fn - Async function to wrap
 */
export async function tryCatch<T, E = Error>(fn: () => Promise<T>): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(error as E);
  }
}

/**
 * Wraps a sync function that might throw into a Result
 * @param fn - Function to wrap
 */
export function tryCatchSync<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    const value = fn();
    return ok(value);
  } catch (error) {
    return err(error as E);
  }
}

