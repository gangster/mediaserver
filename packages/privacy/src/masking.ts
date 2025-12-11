/**
 * Data masking utilities for privacy protection.
 *
 * These utilities mask sensitive data in logs and external communications.
 */

import type { PrivacySettings } from '@mediaserver/core';

/** Data masking options */
export interface MaskingOptions {
  maskFilePaths: boolean;
  maskMediaTitles: boolean;
  maskUserInfo: boolean;
  maskIpAddresses: boolean;
}

/**
 * Creates masking options from privacy settings.
 */
export function createMaskingOptions(settings: PrivacySettings): MaskingOptions {
  return {
    maskFilePaths: settings.maskFilePaths,
    maskMediaTitles: settings.maskMediaTitles,
    maskUserInfo: settings.maskUserInfo,
    maskIpAddresses: settings.maskIpAddresses,
  };
}

/**
 * Masks an email address.
 * Example: "john.doe@example.com" -> "j***@example.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***.***';

  const maskedLocal = local.length > 1 ? local[0] + '***' : '***';
  return `${maskedLocal}@${domain}`;
}

/**
 * Masks an IP address.
 * Example: "192.168.1.100" -> "192.168.x.x"
 */
export function maskIpAddress(ip: string): string {
  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.x.x`;
    }
  }

  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length > 2) {
      return `${parts[0]}:${parts[1]}:****:****`;
    }
  }

  return '***';
}

/**
 * Masks a file path.
 * Example: `/media/Movies/The Matrix (1999)/movie.mkv` -> `/media/star/star/star/movie.mkv`
 */
export function maskFilePath(path: string): string {
  const parts = path.split('/').filter(Boolean);

  if (parts.length <= 2) {
    return path.replace(/[^/]+$/, '***');
  }

  // Keep first directory and filename, mask middle
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `/${first}/***/***/${last}`;
}

/**
 * Masks a media title.
 * Example: "The Matrix" -> "T** M*****"
 */
export function maskMediaTitle(title: string): string {
  return title
    .split(' ')
    .map((word) => {
      if (word.length <= 1) return word;
      return word[0] + '*'.repeat(word.length - 1);
    })
    .join(' ');
}

/**
 * Masks a username/display name.
 * Example: "John Doe" -> "J*** D**"
 */
export function maskUsername(name: string): string {
  return name
    .split(' ')
    .map((part) => {
      if (part.length <= 1) return part;
      return part[0] + '*'.repeat(Math.min(part.length - 1, 3));
    })
    .join(' ');
}

/**
 * Privacy-aware data masking utility.
 * Masks sensitive fields based on privacy settings.
 */
export class DataMasker {
  private options: MaskingOptions;

  constructor(options: MaskingOptions) {
    this.options = options;
  }

  /**
   * Updates masking options.
   */
  updateOptions(options: MaskingOptions): void {
    this.options = options;
  }

  /**
   * Masks a value based on its type.
   */
  mask(value: string, type: 'email' | 'ip' | 'path' | 'title' | 'username'): string {
    switch (type) {
      case 'email':
        return this.options.maskUserInfo ? maskEmail(value) : value;
      case 'ip':
        return this.options.maskIpAddresses ? maskIpAddress(value) : value;
      case 'path':
        return this.options.maskFilePaths ? maskFilePath(value) : value;
      case 'title':
        return this.options.maskMediaTitles ? maskMediaTitle(value) : value;
      case 'username':
        return this.options.maskUserInfo ? maskUsername(value) : value;
      default:
        return value;
    }
  }

  /**
   * Masks sensitive fields in an object.
   * Recognizes common field names and applies appropriate masking.
   */
  maskObject<T extends Record<string, unknown>>(obj: T): T {
    const result = { ...obj } as Record<string, unknown>;

    for (const [key, value] of Object.entries(result)) {
      if (typeof value !== 'string') continue;

      const lowerKey = key.toLowerCase();

      // Email fields
      if (lowerKey.includes('email')) {
        result[key] = this.mask(value, 'email');
      }
      // IP address fields
      else if (lowerKey.includes('ip') || lowerKey === 'address') {
        result[key] = this.mask(value, 'ip');
      }
      // Path fields
      else if (lowerKey.includes('path') || lowerKey.includes('file') || lowerKey.includes('dir')) {
        result[key] = this.mask(value, 'path');
      }
      // Title fields
      else if (lowerKey === 'title' || lowerKey.includes('name') && lowerKey.includes('media')) {
        result[key] = this.mask(value, 'title');
      }
      // Username fields
      else if (
        lowerKey.includes('user') ||
        lowerKey.includes('name') ||
        lowerKey === 'displayname' ||
        lowerKey === 'display_name'
      ) {
        result[key] = this.mask(value, 'username');
      }
    }

    return result as T;
  }
}

/**
 * Creates a data masker from privacy settings.
 */
export function createDataMasker(settings: PrivacySettings): DataMasker {
  return new DataMasker(createMaskingOptions(settings));
}

