/**
 * Media Health Tracking
 *
 * Tracks playback failures to detect "poison" media files that
 * consistently cause problems. Implements:
 * - Failure counting with decay
 * - Suspect → Poison escalation
 * - Automatic fallback policies
 * - Recovery/rehabilitation paths
 *
 * @see docs/TRANSCODING_PIPELINE.md §10 for specification
 */

import type { MediaHealth, PoisonPolicy } from '@mediaserver/core';
import { logger } from '../lib/logger.js';

/** Default poison policy */
const DEFAULT_POISON_POLICY: PoisonPolicy = {
  failureThreshold: 3,   // Failures to become suspect
  poisonThreshold: 5,    // Failures to become poison
  decayPeriodDays: 7,    // Days after which failures decay
};

/** Failure record with timestamp */
interface FailureRecord {
  timestamp: number;
  reason: string;
  sessionId?: string;
  mode?: string;
}

/** Extended health record with failure history */
interface HealthRecord extends MediaHealth {
  failures: FailureRecord[];
  lastSuccessAt?: string;
  successCount: number;
  totalAttempts: number;
}

/**
 * Media Health Tracker
 *
 * In-memory tracker for media health status.
 * Can be persisted to database for long-term tracking.
 */
export class MediaHealthTracker {
  private health: Map<string, HealthRecord> = new Map();
  private policy: PoisonPolicy;

  constructor(policy: Partial<PoisonPolicy> = {}) {
    this.policy = { ...DEFAULT_POISON_POLICY, ...policy };
  }

  /**
   * Record a playback failure.
   */
  recordFailure(
    mediaId: string,
    reason: string,
    sessionId?: string,
    mode?: string
  ): MediaHealth {
    let record = this.health.get(mediaId);

    if (!record) {
      record = this.createRecord(mediaId);
      this.health.set(mediaId, record);
    }

    // Apply decay before adding new failure
    this.applyDecay(record);

    // Add failure
    record.failures.push({
      timestamp: Date.now(),
      reason,
      sessionId,
      mode,
    });
    record.failureCount = record.failures.length;
    record.lastFailureAt = new Date().toISOString();
    record.failureReasons = this.getUniqueReasons(record.failures);
    record.totalAttempts++;

    // Update status
    record.status = this.calculateStatus(record);

    logger.warn(
      {
        mediaId,
        failureCount: record.failureCount,
        status: record.status,
        reason,
      },
      'Media playback failure recorded'
    );

    return this.toMediaHealth(record);
  }

  /**
   * Record a playback success.
   */
  recordSuccess(mediaId: string): MediaHealth {
    let record = this.health.get(mediaId);

    if (!record) {
      record = this.createRecord(mediaId);
      this.health.set(mediaId, record);
    }

    record.lastSuccessAt = new Date().toISOString();
    record.successCount++;
    record.totalAttempts++;

    // Successful playback can rehabilitate suspect media
    if (record.status === 'suspect' && record.successCount >= 3) {
      record.status = 'healthy';
      record.failures = []; // Clear failures
      record.failureCount = 0;

      logger.info(
        { mediaId },
        'Media rehabilitated after successful playback'
      );
    }

    return this.toMediaHealth(record);
  }

  /**
   * Get health status for a media item.
   */
  getHealth(mediaId: string): MediaHealth {
    const record = this.health.get(mediaId);

    if (!record) {
      return {
        mediaId,
        failureCount: 0,
        failureReasons: [],
        status: 'healthy',
      };
    }

    // Apply decay before returning
    this.applyDecay(record);

    return this.toMediaHealth(record);
  }

  /**
   * Check if media is poison.
   */
  isPoison(mediaId: string): boolean {
    return this.getHealth(mediaId).status === 'poison';
  }

  /**
   * Check if media is suspect or poison.
   */
  isSuspect(mediaId: string): boolean {
    const status = this.getHealth(mediaId).status;
    return status === 'suspect' || status === 'poison';
  }

  /**
   * Get recommended fallback mode for media.
   *
   * Returns a more conservative playback mode for problematic media.
   */
  getRecommendedMode(
    mediaId: string,
    requestedMode: string
  ): { mode: string; reason?: string } {
    const health = this.getHealth(mediaId);

    if (health.status === 'healthy') {
      return { mode: requestedMode };
    }

    // For suspect media, prefer transcoding over direct play
    if (health.status === 'suspect') {
      if (requestedMode === 'direct' || requestedMode === 'remux') {
        return {
          mode: 'transcode_hls',
          reason: 'Media marked as suspect, falling back to transcode',
        };
      }
      return { mode: requestedMode };
    }

    // For poison media, always use full transcode
    if (health.status === 'poison') {
      return {
        mode: 'transcode_hls',
        reason: 'Media marked as poison, forcing full transcode',
      };
    }

    return { mode: requestedMode };
  }

  /**
   * Manually mark media as poison (admin action).
   */
  markAsPoison(mediaId: string, reason: string): MediaHealth {
    let record = this.health.get(mediaId);

    if (!record) {
      record = this.createRecord(mediaId);
      this.health.set(mediaId, record);
    }

    record.status = 'poison';
    record.failureReasons = [...record.failureReasons, `Manual: ${reason}`];

    logger.warn(
      { mediaId, reason },
      'Media manually marked as poison'
    );

    return this.toMediaHealth(record);
  }

  /**
   * Manually clear health status (admin action).
   */
  clearHealth(mediaId: string): void {
    this.health.delete(mediaId);

    logger.info(
      { mediaId },
      'Media health status cleared'
    );
  }

  /**
   * Get all unhealthy media.
   */
  getUnhealthyMedia(): MediaHealth[] {
    const unhealthy: MediaHealth[] = [];

    for (const record of this.health.values()) {
      this.applyDecay(record);

      if (record.status !== 'healthy') {
        unhealthy.push(this.toMediaHealth(record));
      }
    }

    return unhealthy;
  }

  /**
   * Get health statistics.
   */
  getStatistics(): {
    healthy: number;
    suspect: number;
    poison: number;
    total: number;
  } {
    let healthy = 0;
    let suspect = 0;
    let poison = 0;

    for (const record of this.health.values()) {
      this.applyDecay(record);

      switch (record.status) {
        case 'healthy':
          healthy++;
          break;
        case 'suspect':
          suspect++;
          break;
        case 'poison':
          poison++;
          break;
      }
    }

    return {
      healthy,
      suspect,
      poison,
      total: this.health.size,
    };
  }

  /**
   * Run maintenance (decay, cleanup).
   */
  runMaintenance(): void {
    const toDelete: string[] = [];

    for (const [mediaId, record] of this.health.entries()) {
      this.applyDecay(record);

      // Remove healthy records with no recent activity
      if (
        record.status === 'healthy' &&
        record.failures.length === 0 &&
        record.totalAttempts === 0
      ) {
        toDelete.push(mediaId);
      }
    }

    for (const mediaId of toDelete) {
      this.health.delete(mediaId);
    }

    if (toDelete.length > 0) {
      logger.debug(
        { cleaned: toDelete.length },
        'Cleaned up healthy media health records'
      );
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private createRecord(mediaId: string): HealthRecord {
    return {
      mediaId,
      failureCount: 0,
      failureReasons: [],
      status: 'healthy',
      failures: [],
      successCount: 0,
      totalAttempts: 0,
    };
  }

  private applyDecay(record: HealthRecord): void {
    const decayMs = this.policy.decayPeriodDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - decayMs;

    // Remove old failures
    const beforeCount = record.failures.length;
    record.failures = record.failures.filter((f) => f.timestamp > cutoff);
    record.failureCount = record.failures.length;

    // Recalculate status if failures decayed
    if (record.failures.length < beforeCount) {
      record.failureReasons = this.getUniqueReasons(record.failures);
      record.status = this.calculateStatus(record);
    }
  }

  private calculateStatus(record: HealthRecord): 'healthy' | 'suspect' | 'poison' {
    if (record.failureCount >= this.policy.poisonThreshold) {
      return 'poison';
    }

    if (record.failureCount >= this.policy.failureThreshold) {
      return 'suspect';
    }

    return 'healthy';
  }

  private getUniqueReasons(failures: FailureRecord[]): string[] {
    const reasons = new Set<string>();
    for (const f of failures) {
      reasons.add(f.reason);
    }
    return Array.from(reasons);
  }

  private toMediaHealth(record: HealthRecord): MediaHealth {
    return {
      mediaId: record.mediaId,
      failureCount: record.failureCount,
      lastFailureAt: record.lastFailureAt,
      failureReasons: record.failureReasons,
      status: record.status,
    };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let healthTracker: MediaHealthTracker | null = null;

/**
 * Get or create the media health tracker.
 */
export function getMediaHealthTracker(
  policy?: Partial<PoisonPolicy>
): MediaHealthTracker {
  if (!healthTracker) {
    healthTracker = new MediaHealthTracker(policy);
  }
  return healthTracker;
}

/**
 * Reset the media health tracker (for testing).
 */
export function resetMediaHealthTracker(): void {
  healthTracker = null;
}
