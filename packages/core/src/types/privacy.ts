/**
 * Privacy-related types.
 */

import type { ISODateString, UUID } from './common.js';

/** Privacy levels */
export type PrivacyLevel = 'maximum' | 'private' | 'balanced' | 'open';

/** Privacy settings */
export interface PrivacySettings {
  id: string;
  level: PrivacyLevel;
  allowExternalConnections: boolean;
  localAnalyticsEnabled: boolean;
  anonymousSharingEnabled: boolean;
  tmdbEnabled: boolean;
  tmdbProxyImages: boolean;
  opensubtitlesEnabled: boolean;
  maskFilePaths: boolean;
  maskMediaTitles: boolean;
  maskUserInfo: boolean;
  maskIpAddresses: boolean;
  analyticsRetentionDays?: number;
  auditRetentionDays?: number;
  externalLogRetentionDays: number;
  anonymousId?: string;
  anonymousIdRotatedAt?: ISODateString;
  lastAnonymousShareAt?: ISODateString;
  updatedAt: ISODateString;
}

/** Audit log action types */
export type AuditAction =
  | 'data_access'
  | 'data_export'
  | 'data_delete'
  | 'external_request'
  | 'config_change'
  | 'user_create'
  | 'user_delete'
  | 'login_attempt'
  | 'privacy_change';

/** Audit log entry */
export interface AuditLog {
  id: UUID;
  action: AuditAction;
  actor: string;
  resource: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: ISODateString;
}

/** External request log */
export interface ExternalRequestLog {
  id: UUID;
  service: string;
  requestType: string;
  dataSummary: string;
  status: 'success' | 'error' | 'cached';
  responseTimeMs?: number;
  cached: boolean;
  createdAt: ISODateString;
}

/** Data export request status */
export type DataExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

/** Data export request */
export interface DataExportRequest {
  id: UUID;
  requestedBy: UUID;
  targetUserId: UUID;
  status: DataExportStatus;
  format: 'json' | 'zip';
  filePath?: string;
  fileSize?: number;
  errorMessage?: string;
  expiresAt?: ISODateString;
  createdAt: ISODateString;
  completedAt?: ISODateString;
}

/** Data deletion scope */
export type DataDeletionScope = 'watch_history' | 'search_history' | 'all_user_data';

/** Data deletion request status */
export type DataDeletionStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Data deletion request */
export interface DataDeletionRequest {
  id: UUID;
  requestedBy: UUID;
  targetUserId: UUID;
  status: DataDeletionStatus;
  scope: DataDeletionScope;
  reason?: string;
  itemsDeleted?: number;
  errorMessage?: string;
  createdAt: ISODateString;
  completedAt?: ISODateString;
}

/** Privacy dashboard stats */
export interface PrivacyDashboardStats {
  externalRequestsToday: number;
  externalRequestsWeek: number;
  cachedResponsesPercent: number;
  auditLogEntries: number;
  enabledExternalServices: string[];
  lastAuditLogEntry?: AuditLog;
}

/** Privacy level presets */
export const PRIVACY_LEVEL_PRESETS: Record<PrivacyLevel, Partial<PrivacySettings>> = {
  maximum: {
    allowExternalConnections: false,
    localAnalyticsEnabled: false,
    anonymousSharingEnabled: false,
    tmdbEnabled: false,
    tmdbProxyImages: true,
    opensubtitlesEnabled: false,
    maskFilePaths: true,
    maskMediaTitles: true,
    maskUserInfo: true,
    maskIpAddresses: true,
  },
  private: {
    allowExternalConnections: false,
    localAnalyticsEnabled: true,
    anonymousSharingEnabled: false,
    tmdbEnabled: false,
    tmdbProxyImages: true,
    opensubtitlesEnabled: false,
    maskFilePaths: true,
    maskMediaTitles: true,
    maskUserInfo: true,
    maskIpAddresses: true,
  },
  balanced: {
    allowExternalConnections: true,
    localAnalyticsEnabled: true,
    anonymousSharingEnabled: false,
    tmdbEnabled: true,
    tmdbProxyImages: true,
    opensubtitlesEnabled: false,
    maskFilePaths: true,
    maskMediaTitles: false,
    maskUserInfo: true,
    maskIpAddresses: true,
  },
  open: {
    allowExternalConnections: true,
    localAnalyticsEnabled: true,
    anonymousSharingEnabled: true,
    tmdbEnabled: true,
    tmdbProxyImages: false,
    opensubtitlesEnabled: true,
    maskFilePaths: false,
    maskMediaTitles: false,
    maskUserInfo: false,
    maskIpAddresses: false,
  },
} as const;

