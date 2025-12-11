/**
 * User-related types.
 */

import type { ISODateString, UUID } from './common.js';

/** User roles in the system */
export type UserRole = 'owner' | 'admin' | 'member' | 'guest';

/** User entity */
export interface User {
  id: UUID;
  email: string;
  role: UserRole;
  displayName: string;
  avatarUrl?: string;
  isActive: boolean;
  preferredAudioLang: string;
  preferredSubtitleLang?: string;
  enableSubtitles: boolean;
  language: string;
  sessionTimeout?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastLoginAt?: ISODateString;
}

/** User without sensitive fields (for API responses) */
export type SafeUser = Omit<User, 'sessionTimeout'>;

/** User profile update input */
export interface UpdateProfileInput {
  displayName?: string;
  avatarUrl?: string;
  preferredAudioLang?: string;
  preferredSubtitleLang?: string;
  enableSubtitles?: boolean;
  language?: string;
}

/** User preferences */
export interface UserPreferences {
  displayName: string;
  avatarUrl?: string;
  preferredAudioLang: string;
  preferredSubtitleLang?: string;
  enableSubtitles: boolean;
  language: string;
  defaultQuality: QualityProfile;
  posterSize: 'small' | 'medium' | 'large';
  gridColumns: number;
}

/** Quality profile for streaming */
export type QualityProfile = 'original' | '4k' | '1080p' | '720p' | '480p';

/** User invitation */
export interface UserInvitation {
  id: UUID;
  email: string;
  role: Extract<UserRole, 'member' | 'guest'>;
  inviteCode: string;
  invitedBy: UUID;
  libraryIds?: UUID[];
  expiresAt: ISODateString;
  acceptedAt?: ISODateString;
  createdAt: ISODateString;
}

/** Role capabilities - what each role can do */
export interface RoleCapabilities {
  canManageServer: boolean;
  canDeleteServer: boolean;
  canManageBilling: boolean;
  canInviteUsers: boolean;
  canManageUsers: boolean;
  canAssignRoles: boolean;
  canRemoveUsers: boolean;
  canCreateLibraries: boolean;
  canDeleteLibraries: boolean;
  canScanLibraries: boolean;
  canManageMetadata: boolean;
  canAccessAllLibraries: boolean;
  canShareLibraries: boolean;
  canManageSettings: boolean;
  canManagePrivacy: boolean;
  canViewAuditLogs: boolean;
}

/** Role capabilities mapping */
export const ROLE_CAPABILITIES: Record<UserRole, RoleCapabilities> = {
  owner: {
    canManageServer: true,
    canDeleteServer: true,
    canManageBilling: true,
    canInviteUsers: true,
    canManageUsers: true,
    canAssignRoles: true,
    canRemoveUsers: true,
    canCreateLibraries: true,
    canDeleteLibraries: true,
    canScanLibraries: true,
    canManageMetadata: true,
    canAccessAllLibraries: true,
    canShareLibraries: true,
    canManageSettings: true,
    canManagePrivacy: true,
    canViewAuditLogs: true,
  },
  admin: {
    canManageServer: false,
    canDeleteServer: false,
    canManageBilling: false,
    canInviteUsers: true,
    canManageUsers: true,
    canAssignRoles: true,
    canRemoveUsers: true,
    canCreateLibraries: true,
    canDeleteLibraries: true,
    canScanLibraries: true,
    canManageMetadata: true,
    canAccessAllLibraries: true,
    canShareLibraries: true,
    canManageSettings: true,
    canManagePrivacy: true,
    canViewAuditLogs: true,
  },
  member: {
    canManageServer: false,
    canDeleteServer: false,
    canManageBilling: false,
    canInviteUsers: false,
    canManageUsers: false,
    canAssignRoles: false,
    canRemoveUsers: false,
    canCreateLibraries: false,
    canDeleteLibraries: false,
    canScanLibraries: false,
    canManageMetadata: false,
    canAccessAllLibraries: false,
    canShareLibraries: false,
    canManageSettings: false,
    canManagePrivacy: false,
    canViewAuditLogs: false,
  },
  guest: {
    canManageServer: false,
    canDeleteServer: false,
    canManageBilling: false,
    canInviteUsers: false,
    canManageUsers: false,
    canAssignRoles: false,
    canRemoveUsers: false,
    canCreateLibraries: false,
    canDeleteLibraries: false,
    canScanLibraries: false,
    canManageMetadata: false,
    canAccessAllLibraries: false,
    canShareLibraries: false,
    canManageSettings: false,
    canManagePrivacy: false,
    canViewAuditLogs: false,
  },
} as const;

/**
 * Checks if a role has a specific capability
 */
export function hasCapability(role: UserRole, capability: keyof RoleCapabilities): boolean {
  return ROLE_CAPABILITIES[role][capability];
}

