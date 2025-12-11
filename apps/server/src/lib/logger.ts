/**
 * Logger setup using Pino.
 */

import pino from 'pino';

/** Log levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Creates a configured logger instance.
 */
export function createLogger(level: LogLevel = 'info') {
  return pino({
    level,
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Redact sensitive fields
    redact: {
      paths: [
        'password',
        'passwordHash',
        'token',
        'authorization',
        'accessToken',
        'refreshToken',
        '*.password',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
    // Add default context
    base: {
      service: 'mediaserver',
    },
    // Pretty print in development
    transport:
      process.env['NODE_ENV'] !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          }
        : undefined,
  });
}

/** Default logger instance */
export const logger = createLogger();

export default logger;

