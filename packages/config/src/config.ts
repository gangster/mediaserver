/**
 * Configuration file loading and validation.
 */

import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Transcoding profile schema.
 */
const transcodeProfileSchema = z.object({
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  videoBitrate: z.string(),
  audioBitrate: z.string(),
});

/**
 * Full configuration schema.
 */
export const configSchema = z.object({
  server: z
    .object({
      port: z.number().int().min(1).max(65535).default(3000),
      host: z.string().default('0.0.0.0'),
      trustProxy: z.boolean().default(false),
    })
    .default({}),

  paths: z
    .object({
      data: z.string().default('./data'),
      transcodes: z.string().default('./transcodes'),
      cache: z.string().default('./cache'),
      logs: z.string().default('./logs'),
    })
    .default({}),

  logging: z
    .object({
      level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
      format: z.enum(['json', 'pretty']).default('json'),
    })
    .default({}),

  transcoding: z
    .object({
      enabled: z.boolean().default(true),
      hwAccel: z.enum(['auto', 'nvidia', 'vaapi', 'videotoolbox', 'none']).default('auto'),
      threads: z.number().int().min(0).default(0),
      profiles: z
        .array(transcodeProfileSchema)
        .default([
          { name: '1080p', width: 1920, height: 1080, videoBitrate: '8000k', audioBitrate: '192k' },
          { name: '720p', width: 1280, height: 720, videoBitrate: '4000k', audioBitrate: '128k' },
          { name: '480p', width: 854, height: 480, videoBitrate: '1500k', audioBitrate: '128k' },
        ]),
    })
    .default({}),

  scanning: z
    .object({
      watchForChanges: z.boolean().default(true),
      scanOnStartup: z.boolean().default(true),
      ignorePatterns: z
        .array(z.string())
        .default(['*.sample.*', '*trailer*', '*featurette*', '.DS_Store', 'Thumbs.db']),
    })
    .default({}),

  cache: z
    .object({
      metadata: z
        .object({
          maxItems: z.number().int().positive().default(10000),
          ttlMinutes: z.number().int().positive().default(60),
        })
        .default({}),
      images: z
        .object({
          maxSizeMB: z.number().int().positive().default(500),
          ttlDays: z.number().int().positive().default(30),
        })
        .default({}),
    })
    .default({}),

  security: z
    .object({
      rateLimiting: z
        .object({
          enabled: z.boolean().default(true),
          windowMs: z.number().int().positive().default(60000),
          maxRequests: z.number().int().positive().default(100),
        })
        .default({}),
      cors: z
        .object({
          enabled: z.boolean().default(true),
          origins: z.array(z.string()).default([]),
        })
        .default({}),
    })
    .default({}),
});

/** Type for configuration */
export type Config = z.infer<typeof configSchema>;

/** Type for transcoding profile */
export type TranscodeProfile = z.infer<typeof transcodeProfileSchema>;

/**
 * Deep merges two objects.
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Applies environment variable overrides to config.
 * Uses z.input type since we're building partial config before validation.
 */
function applyEnvOverrides(config: z.input<typeof configSchema>): z.input<typeof configSchema> {
  const result = { ...config };

  // PORT -> config.server.port
  if (process.env['PORT']) {
    result.server = { ...result.server, port: parseInt(process.env['PORT'], 10) };
  }

  // HOST -> config.server.host
  if (process.env['HOST']) {
    result.server = { ...result.server, host: process.env['HOST'] };
  }

  // LOG_LEVEL -> config.logging.level
  if (process.env['LOG_LEVEL']) {
    result.logging = {
      ...result.logging,
      level: process.env['LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error',
    };
  }

  // DATA_DIR -> config.paths.data
  if (process.env['DATA_DIR']) {
    result.paths = { ...result.paths, data: process.env['DATA_DIR'] };
  }

  // TRANSCODES_DIR -> config.paths.transcodes
  if (process.env['TRANSCODES_DIR']) {
    result.paths = { ...result.paths, transcodes: process.env['TRANSCODES_DIR'] };
  }

  // CACHE_DIR -> config.paths.cache
  if (process.env['CACHE_DIR']) {
    result.paths = { ...result.paths, cache: process.env['CACHE_DIR'] };
  }

  return result;
}

/**
 * Loads configuration from file and environment.
 * Priority: Environment > Config file > Defaults
 *
 * @param configPath - Optional explicit path to config file
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  let config: z.input<typeof configSchema> = {};

  // Determine config file paths to try
  const configPaths = configPath
    ? [configPath]
    : ['config.yaml', 'config.yml', 'config.json'].map((f) => path.resolve(process.cwd(), f));

  // Try to load config file
  for (const filePath of configPaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = filePath.endsWith('.json') ? JSON.parse(content) : parseYaml(content);
        config = deepMerge(config as Record<string, unknown>, parsed) as z.input<typeof configSchema>;
        break;
      }
    } catch (error) {
      console.warn(`Warning: Could not load config from ${filePath}:`, error);
    }
  }

  // Apply environment variable overrides
  config = applyEnvOverrides(config);

  // Validate and apply defaults
  const result = configSchema.safeParse(config);

  if (!result.success) {
    console.error('❌ Invalid configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Invalid configuration');
  }

  return result.data;
}

/**
 * Synchronous config loading for simpler use cases.
 */
export function loadConfigSync(configPath?: string): Config {
  let config: z.input<typeof configSchema> = {};

  const configPaths = configPath
    ? [configPath]
    : ['config.yaml', 'config.yml', 'config.json'].map((f) => path.resolve(process.cwd(), f));

  for (const filePath of configPaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = filePath.endsWith('.json') ? JSON.parse(content) : parseYaml(content);
        config = deepMerge(config as Record<string, unknown>, parsed) as z.input<typeof configSchema>;
        break;
      }
    } catch (error) {
      console.warn(`Warning: Could not load config from ${filePath}:`, error);
    }
  }

  config = applyEnvOverrides(config);

  const result = configSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Creates a default configuration object.
 */
export function createDefaultConfig(): Config {
  return configSchema.parse({});
}

