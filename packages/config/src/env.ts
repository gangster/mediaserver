/**
 * Environment variable validation and loading.
 */

import { z } from 'zod';

/**
 * Schema for required environment variables.
 */
export const envSchema = z.object({
  // === Required ===
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  // === Server ===
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // === Paths ===
  DATA_DIR: z.string().default('./data'),
  TRANSCODES_DIR: z.string().default('./transcodes'),
  CACHE_DIR: z.string().default('./cache'),
  LOGS_DIR: z.string().default('./logs'),

  // === Optional: External Services ===
  TMDB_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),

  // === Optional: Remote Access ===
  TAILSCALE_AUTHKEY: z.string().optional(),

  // === Optional: Premium/Licensing ===
  LICENSE_SERVER_URL: z.string().url().optional(),

  // === Optional: Database (Turso) ===
  DATABASE_AUTH_TOKEN: z.string().optional(),

  // === Optional: Redis (for multi-instance) ===
  REDIS_URL: z.string().url().optional(),
});

/** Type for validated environment variables */
export type Env = z.infer<typeof envSchema>;

/**
 * Loads and validates environment variables.
 * @throws If required variables are missing or invalid
 */
export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    console.error('❌ Invalid environment variables:');
    for (const [key, messages] of Object.entries(errors)) {
      console.error(`  ${key}: ${messages?.join(', ')}`);
    }
    process.exit(1);
  }

  return result.data;
}

/**
 * Validates environment without exiting process.
 * Useful for testing.
 */
export function validateEnv(env: Record<string, unknown>): { success: true; data: Env } | { success: false; errors: Record<string, string[] | undefined> } {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Checks if running in development mode.
 */
export function isDevelopment(env: Env): boolean {
  return env.NODE_ENV === 'development';
}

/**
 * Checks if running in production mode.
 */
export function isProduction(env: Env): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Checks if running in test mode.
 */
export function isTest(env: Env): boolean {
  return env.NODE_ENV === 'test';
}

