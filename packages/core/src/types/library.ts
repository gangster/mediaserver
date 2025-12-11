/**
 * Library-related types.
 */

import type { ContentRating, ISODateString, UUID } from './common.js';

/** Library type */
export type LibraryType = 'movie' | 'tv';

/** Library entity */
export interface Library {
  id: UUID;
  name: string;
  type: LibraryType;
  paths: string[];
  enabled: boolean;
  lastScannedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Library with item counts */
export interface LibraryWithCounts extends Library {
  itemCount: number;
}

/** Create library input */
export interface CreateLibraryInput {
  name: string;
  type: LibraryType;
  paths: string[];
  enabled?: boolean;
}

/** Update library input */
export interface UpdateLibraryInput {
  name?: string;
  paths?: string[];
  enabled?: boolean;
}

/** Library scan status */
export type ScanStatus = 'idle' | 'scanning' | 'error';

/** Library scan progress */
export interface ScanProgress {
  libraryId: UUID;
  status: ScanStatus;
  progress: number;
  currentFile?: string;
  itemsScanned: number;
  itemsTotal: number;
  newItems: number;
  updatedItems: number;
  removedItems: number;
  errors: number;
  startedAt?: ISODateString;
  completedAt?: ISODateString;
  error?: string;
}

/** Library permission */
export interface LibraryPermission {
  id: UUID;
  userId: UUID;
  libraryId: UUID;
  canView: boolean;
  canWatch: boolean;
  canDownload: boolean;
  maxContentRating?: ContentRating;
  grantedBy: UUID;
  grantedAt: ISODateString;
  expiresAt?: ISODateString;
}

/** Grant library permission input */
export interface GrantLibraryPermissionInput {
  userId: UUID;
  libraryId: UUID;
  canView?: boolean;
  canWatch?: boolean;
  canDownload?: boolean;
  maxContentRating?: ContentRating;
  expiresAt?: ISODateString;
}

/** Collection types */
export type CollectionType = 'auto' | 'manual' | 'builtin';

/** Collection entity */
export interface Collection {
  id: UUID;
  name: string;
  description?: string;
  type: CollectionType;
  rules?: CollectionRule[];
  sortOrder: number;
  posterPath?: string;
  backdropPath?: string;
  isPublic: boolean;
  createdBy?: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Collection rule for auto-collections */
export interface CollectionRule {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'in' | 'between';
  value: string | number | string[] | number[];
}

/** Collection item */
export interface CollectionItem {
  id: UUID;
  collectionId: UUID;
  mediaType: 'movie' | 'tvshow';
  mediaId: UUID;
  sortOrder: number;
  addedAt: ISODateString;
}

