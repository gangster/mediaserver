/**
 * Admission Control & Queue Management
 *
 * Controls access to transcoding resources:
 * - Concurrent transcode limits
 * - Priority-based queuing
 * - Queue timeouts
 * - Disk pressure monitoring
 * - Fair scheduling
 *
 * @see docs/TRANSCODING_PIPELINE.md §11 for specification
 */

import { EventEmitter } from 'node:events';
import { statfs } from 'node:fs/promises';
import type {
  AdmissionPolicy,
  QueuePolicy,
  DiskPressureConfig,
  DiskPressureLevel,
  ServerCapabilities,
} from '@mediaserver/core';
import { logger } from '../lib/logger.js';

/** Priority levels for transcode jobs */
export type JobPriority = 'interactive' | 'prefetch' | 'trickplay' | 'background';

/** Priority values (lower = higher priority) */
const PRIORITY_VALUES: Record<JobPriority, number> = {
  interactive: 0,
  prefetch: 1,
  trickplay: 2,
  background: 3,
};

/** Queued job */
export interface QueuedJob {
  id: string;
  sessionId: string;
  userId: string;
  mediaId: string;
  priority: JobPriority;
  queuedAt: number;
  timeoutAt: number;
  resolve: (admitted: boolean) => void;
  reject: (error: Error) => void;
}

/** Active job tracking */
interface ActiveJob {
  id: string;
  sessionId: string;
  userId: string;
  startedAt: number;
}

/** Admission result */
export interface AdmissionResult {
  admitted: boolean;
  position?: number;
  estimatedWaitMs?: number;
  reason?: string;
}

/** Default policies */
const DEFAULT_ADMISSION_POLICY: AdmissionPolicy = {
  maxConcurrent: 2,
  maxQueueDepth: 20,
  priorityLevels: {
    interactive: 0,
    prefetch: 1,
    trickplay: 2,
    background: 3,
  },
};

const DEFAULT_QUEUE_POLICY: QueuePolicy = {
  interactiveTimeoutMs: 15_000,
  prefetchTimeoutMs: 60_000,
  trickplayTimeoutMs: 30_000,
  backgroundTimeoutMs: 300_000,
  starvationProtection: true,
};

const DEFAULT_DISK_CONFIG: DiskPressureConfig = {
  warningThresholdGB: 10,
  criticalThresholdGB: 2,
  maxCacheSizePerUserGB: 20,
  maxTotalCacheSizeGB: 100,
};

/**
 * Admission Controller
 *
 * Manages access to limited transcoding resources with fair queuing.
 */
export class AdmissionController extends EventEmitter {
  private queue: QueuedJob[] = [];
  private active: Map<string, ActiveJob> = new Map();
  private admissionPolicy: AdmissionPolicy;
  private queuePolicy: QueuePolicy;
  private diskConfig: DiskPressureConfig;
  private diskPressure: DiskPressureLevel = 'normal';
  private cacheDir: string;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    cacheDir: string,
    serverCaps?: ServerCapabilities,
    options?: {
      admissionPolicy?: Partial<AdmissionPolicy>;
      queuePolicy?: Partial<QueuePolicy>;
      diskConfig?: Partial<DiskPressureConfig>;
    }
  ) {
    super();

    this.cacheDir = cacheDir;

    // Set max concurrent based on server capabilities
    const maxConcurrent = serverCaps?.maxConcurrentTranscodes ?? DEFAULT_ADMISSION_POLICY.maxConcurrent;

    this.admissionPolicy = {
      ...DEFAULT_ADMISSION_POLICY,
      maxConcurrent,
      ...options?.admissionPolicy,
    };
    this.queuePolicy = { ...DEFAULT_QUEUE_POLICY, ...options?.queuePolicy };
    this.diskConfig = { ...DEFAULT_DISK_CONFIG, ...options?.diskConfig };

    // Start periodic checks
    this.startPeriodicChecks();
  }

  /**
   * Request admission for a transcode job.
   *
   * Returns a promise that resolves when the job is admitted or rejected.
   */
  async requestAdmission(
    jobId: string,
    sessionId: string,
    userId: string,
    mediaId: string,
    priority: JobPriority = 'interactive'
  ): Promise<AdmissionResult> {
    // Check disk pressure
    if (this.diskPressure === 'critical') {
      return {
        admitted: false,
        reason: 'Disk pressure critical, transcoding disabled',
      };
    }

    // Check if already active
    if (this.active.has(jobId)) {
      return { admitted: true };
    }

    // Check if we have capacity
    if (this.active.size < this.admissionPolicy.maxConcurrent) {
      this.admitJob(jobId, sessionId, userId);
      return { admitted: true };
    }

    // Check queue depth
    if (this.queue.length >= this.admissionPolicy.maxQueueDepth) {
      // If interactive, try to preempt lower priority
      if (priority === 'interactive') {
        const preempted = this.tryPreempt(priority);
        if (preempted) {
          this.admitJob(jobId, sessionId, userId);
          return { admitted: true };
        }
      }

      return {
        admitted: false,
        reason: 'Queue full',
        position: this.queue.length,
      };
    }

    // Queue the job
    return this.queueJob(jobId, sessionId, userId, mediaId, priority);
  }

  /**
   * Release admission for a completed job.
   */
  releaseAdmission(jobId: string): void {
    const job = this.active.get(jobId);
    if (!job) return;

    this.active.delete(jobId);

    logger.debug(
      { jobId, activeCount: this.active.size },
      'Released admission'
    );

    // Process queue
    this.processQueue();
  }

  /**
   * Cancel a queued job.
   */
  cancelJob(jobId: string): boolean {
    const index = this.queue.findIndex((j) => j.id === jobId);
    if (index === -1) return false;

    const job = this.queue[index];
    if (job) {
      this.queue.splice(index, 1);
      job.resolve(false);
    }

    return true;
  }

  /**
   * Get current status.
   */
  getStatus(): {
    activeCount: number;
    queueDepth: number;
    maxConcurrent: number;
    diskPressure: DiskPressureLevel;
    queuedJobs: Array<{
      id: string;
      priority: JobPriority;
      waitingMs: number;
    }>;
  } {
    return {
      activeCount: this.active.size,
      queueDepth: this.queue.length,
      maxConcurrent: this.admissionPolicy.maxConcurrent,
      diskPressure: this.diskPressure,
      queuedJobs: this.queue.map((j) => ({
        id: j.id,
        priority: j.priority,
        waitingMs: Date.now() - j.queuedAt,
      })),
    };
  }

  /**
   * Get position in queue.
   */
  getQueuePosition(jobId: string): number | null {
    const index = this.queue.findIndex((j) => j.id === jobId);
    return index === -1 ? null : index;
  }

  /**
   * Check if admission is available.
   */
  hasCapacity(): boolean {
    return (
      this.active.size < this.admissionPolicy.maxConcurrent &&
      this.diskPressure !== 'critical'
    );
  }

  /**
   * Update disk pressure level.
   */
  async checkDiskPressure(): Promise<DiskPressureLevel> {
    try {
      const stats = await statfs(this.cacheDir);
      const freeGB = (stats.bfree * stats.bsize) / (1024 * 1024 * 1024);

      if (freeGB < this.diskConfig.criticalThresholdGB) {
        this.diskPressure = 'critical';
      } else if (freeGB < this.diskConfig.warningThresholdGB) {
        this.diskPressure = 'warning';
      } else {
        this.diskPressure = 'normal';
      }

      if (this.diskPressure !== 'normal') {
        logger.warn(
          { diskPressure: this.diskPressure, freeGB },
          'Disk pressure detected'
        );
      }
    } catch (error) {
      // If we can't check, assume normal
      this.diskPressure = 'normal';
    }

    return this.diskPressure;
  }

  /**
   * Shutdown the controller.
   */
  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Reject all queued jobs
    for (const job of this.queue) {
      job.reject(new Error('Admission controller shutdown'));
    }
    this.queue = [];
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private admitJob(jobId: string, sessionId: string, userId: string): void {
    this.active.set(jobId, {
      id: jobId,
      sessionId,
      userId,
      startedAt: Date.now(),
    });

    logger.debug(
      { jobId, activeCount: this.active.size },
      'Job admitted'
    );

    this.emit('admitted', jobId);
  }

  private queueJob(
    jobId: string,
    sessionId: string,
    userId: string,
    mediaId: string,
    priority: JobPriority
  ): Promise<AdmissionResult> {
    const timeout = this.getTimeout(priority);
    const queuedAt = Date.now();

    return new Promise((resolve, reject) => {
      const job: QueuedJob = {
        id: jobId,
        sessionId,
        userId,
        mediaId,
        priority,
        queuedAt,
        timeoutAt: queuedAt + timeout,
        resolve: (admitted) => {
          if (admitted) {
            resolve({ admitted: true });
          } else {
            resolve({
              admitted: false,
              reason: 'Queue timeout',
            });
          }
        },
        reject,
      };

      // Insert in priority order
      const insertIndex = this.findInsertIndex(priority);
      this.queue.splice(insertIndex, 0, job);

      const position = this.queue.indexOf(job);

      logger.debug(
        { jobId, priority, position, queueDepth: this.queue.length },
        'Job queued'
      );

      // Return position info
      setTimeout(() => {
        // Only resolve with position if still in queue
        if (this.queue.includes(job)) {
          // Don't resolve here - wait for admission
        }
      }, 0);
    });
  }

  private findInsertIndex(priority: JobPriority): number {
    const value = PRIORITY_VALUES[priority];

    // Find first job with lower priority (higher value)
    for (let i = 0; i < this.queue.length; i++) {
      const job = this.queue[i];
      if (job && PRIORITY_VALUES[job.priority] > value) {
        return i;
      }
    }

    return this.queue.length;
  }

  private processQueue(): void {
    while (
      this.queue.length > 0 &&
      this.active.size < this.admissionPolicy.maxConcurrent &&
      this.diskPressure !== 'critical'
    ) {
      const job = this.queue.shift();
      if (!job) break;

      this.admitJob(job.id, job.sessionId, job.userId);
      job.resolve(true);
    }
  }

  private tryPreempt(_priority: JobPriority): boolean {
    // Find lowest priority active job
    // Note: Full preemption would require tracking priority in active jobs
    // and implementing graceful job cancellation. For now, we don't preempt.
    // This is a future enhancement opportunity.
    return false;
  }

  private getTimeout(priority: JobPriority): number {
    switch (priority) {
      case 'interactive':
        return this.queuePolicy.interactiveTimeoutMs;
      case 'prefetch':
        return this.queuePolicy.prefetchTimeoutMs;
      case 'trickplay':
        return this.queuePolicy.trickplayTimeoutMs;
      case 'background':
        return this.queuePolicy.backgroundTimeoutMs;
    }
  }

  private startPeriodicChecks(): void {
    // Check every 10 seconds
    this.checkInterval = setInterval(() => {
      this.checkTimeouts();
      this.checkDiskPressure();
    }, 10_000);
  }

  private checkTimeouts(): void {
    const now = Date.now();
    const timedOut: QueuedJob[] = [];

    for (const job of this.queue) {
      if (now >= job.timeoutAt) {
        timedOut.push(job);
      }
    }

    for (const job of timedOut) {
      const index = this.queue.indexOf(job);
      if (index !== -1) {
        this.queue.splice(index, 1);
        job.resolve(false);

        logger.warn(
          { jobId: job.id, priority: job.priority, waitedMs: now - job.queuedAt },
          'Job timed out in queue'
        );
      }
    }

    // Apply starvation protection
    if (this.queuePolicy.starvationProtection) {
      this.applyStarvationProtection(now);
    }
  }

  private applyStarvationProtection(now: number): void {
    // Boost priority of jobs waiting too long
    const boostThresholdMs = 30_000;

    for (const job of this.queue) {
      const waitedMs = now - job.queuedAt;

      if (waitedMs > boostThresholdMs && job.priority !== 'interactive') {
        // Move toward front of queue
        const index = this.queue.indexOf(job);
        if (index > 0) {
          this.queue.splice(index, 1);
          this.queue.unshift(job);

          logger.debug(
            { jobId: job.id, waitedMs },
            'Boosted starving job priority'
          );
        }
      }
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let admissionController: AdmissionController | null = null;

/**
 * Initialize the admission controller.
 */
export function initAdmissionController(
  cacheDir: string,
  serverCaps?: ServerCapabilities,
  options?: {
    admissionPolicy?: Partial<AdmissionPolicy>;
    queuePolicy?: Partial<QueuePolicy>;
    diskConfig?: Partial<DiskPressureConfig>;
  }
): AdmissionController {
  if (admissionController) {
    return admissionController;
  }

  admissionController = new AdmissionController(cacheDir, serverCaps, options);
  return admissionController;
}

/**
 * Get the admission controller.
 */
export function getAdmissionController(): AdmissionController {
  if (!admissionController) {
    throw new Error('Admission controller not initialized');
  }
  return admissionController;
}

/**
 * Shutdown the admission controller.
 */
export function shutdownAdmissionController(): void {
  if (admissionController) {
    admissionController.shutdown();
    admissionController = null;
  }
}
