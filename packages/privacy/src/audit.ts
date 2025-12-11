/**
 * Audit logging for privacy-sensitive actions.
 */

import { generateId } from '@mediaserver/core';
import type { AuditAction, AuditLog } from '@mediaserver/core';

/** Audit log creation input */
export interface CreateAuditLogInput {
  action: AuditAction;
  actor: string;
  resource: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/** Audit logger callback type */
export type AuditLogCallback = (entry: AuditLog) => Promise<void>;

/**
 * Audit Logger
 *
 * Provides structured audit logging for privacy-sensitive actions.
 * All audit logs are stored locally and never sent externally.
 */
export class AuditLogger {
  private callback?: AuditLogCallback;

  constructor(callback?: AuditLogCallback) {
    this.callback = callback;
  }

  /**
   * Sets the log callback.
   */
  setCallback(callback: AuditLogCallback): void {
    this.callback = callback;
  }

  /**
   * Logs an audit event.
   */
  async log(input: CreateAuditLogInput): Promise<AuditLog> {
    const entry: AuditLog = {
      id: generateId(),
      action: input.action,
      actor: input.actor,
      resource: input.resource,
      details: input.details,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: new Date().toISOString(),
    };

    if (this.callback) {
      try {
        await this.callback(entry);
      } catch (error) {
        // Audit log failure shouldn't break the application
        console.error('Failed to save audit log:', error);
      }
    }

    return entry;
  }

  /**
   * Logs a data access event.
   */
  async logDataAccess(
    actor: string,
    resource: string,
    details?: Record<string, unknown>,
    ipAddress?: string
  ): Promise<AuditLog> {
    return this.log({
      action: 'data_access',
      actor,
      resource,
      details,
      ipAddress,
    });
  }

  /**
   * Logs a data export event.
   */
  async logDataExport(
    actor: string,
    targetUserId: string,
    format: string,
    ipAddress?: string
  ): Promise<AuditLog> {
    return this.log({
      action: 'data_export',
      actor,
      resource: `user:${targetUserId}`,
      details: { format },
      ipAddress,
    });
  }

  /**
   * Logs a data deletion event.
   */
  async logDataDelete(
    actor: string,
    targetUserId: string,
    scope: string,
    itemsDeleted: number,
    ipAddress?: string
  ): Promise<AuditLog> {
    return this.log({
      action: 'data_delete',
      actor,
      resource: `user:${targetUserId}`,
      details: { scope, itemsDeleted },
      ipAddress,
    });
  }

  /**
   * Logs an external request event.
   */
  async logExternalRequest(
    service: string,
    requestType: string,
    status: string,
    responseTimeMs?: number
  ): Promise<AuditLog> {
    return this.log({
      action: 'external_request',
      actor: 'system',
      resource: service,
      details: { requestType, status, responseTimeMs },
    });
  }

  /**
   * Logs a configuration change event.
   */
  async logConfigChange(
    actor: string,
    configKey: string,
    oldValue: unknown,
    newValue: unknown,
    ipAddress?: string
  ): Promise<AuditLog> {
    return this.log({
      action: 'config_change',
      actor,
      resource: configKey,
      details: {
        // Don't log sensitive values
        changed: oldValue !== newValue,
      },
      ipAddress,
    });
  }

  /**
   * Logs a user creation event.
   */
  async logUserCreate(actor: string, newUserId: string, role: string, ipAddress?: string): Promise<AuditLog> {
    return this.log({
      action: 'user_create',
      actor,
      resource: `user:${newUserId}`,
      details: { role },
      ipAddress,
    });
  }

  /**
   * Logs a user deletion event.
   */
  async logUserDelete(actor: string, deletedUserId: string, ipAddress?: string): Promise<AuditLog> {
    return this.log({
      action: 'user_delete',
      actor,
      resource: `user:${deletedUserId}`,
      ipAddress,
    });
  }

  /**
   * Logs a login attempt event.
   */
  async logLoginAttempt(
    email: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLog> {
    return this.log({
      action: 'login_attempt',
      actor: email,
      resource: 'auth',
      details: { success },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Logs a privacy settings change event.
   */
  async logPrivacyChange(actor: string, changedFields: string[], ipAddress?: string): Promise<AuditLog> {
    return this.log({
      action: 'privacy_change',
      actor,
      resource: 'privacy_settings',
      details: { changedFields },
      ipAddress,
    });
  }
}

/**
 * Creates an audit logger instance.
 */
export function createAuditLogger(callback?: AuditLogCallback): AuditLogger {
  return new AuditLogger(callback);
}

