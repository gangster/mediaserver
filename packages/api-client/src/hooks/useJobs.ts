/**
 * Job-related hooks for managing background jobs.
 */

import { trpc } from '../client.js';

/**
 * Hook for listing jobs with pagination and filters.
 * Polls every 3 seconds for real-time updates.
 */
export function useJobs(options?: {
  page?: number;
  limit?: number;
  status?: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
  type?: 'scan' | 'metadata_refresh' | 'metadata_identify' | 'transcode' | 'thumbnail' | 'cleanup';
  queue?: 'scan' | 'metadata' | 'transcode';
}) {
  return trpc.jobs.list.useQuery({
    page: options?.page ?? 1,
    limit: options?.limit ?? 20,
    status: options?.status,
    type: options?.type,
    queue: options?.queue,
  }, {
    refetchInterval: 3000, // Poll every 3 seconds for real-time updates
  });
}

/**
 * Hook for getting a single job by ID.
 * When enabled, polls every 2 seconds to track job progress.
 */
export function useJob(id: string, enabled = true) {
  return trpc.jobs.get.useQuery({ id }, {
    enabled,
    refetchInterval: enabled ? 2000 : false, // Poll every 2 seconds when enabled
  });
}

/**
 * Hook for getting active jobs (for dashboard).
 * Polls every 2 seconds for real-time updates.
 */
export function useActiveJobs() {
  return trpc.jobs.active.useQuery(undefined, {
    refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
  });
}

/**
 * Hook for getting queue statistics.
 * Polls every 3 seconds for real-time updates.
 */
export function useJobStats() {
  return trpc.jobs.stats.useQuery(undefined, {
    refetchInterval: 3000, // Refetch every 3 seconds for real-time updates
  });
}

/**
 * Hook for cancelling a job.
 */
export function useCancelJob() {
  return trpc.jobs.cancel.useMutation();
}

/**
 * Hook for retrying a failed job.
 */
export function useRetryJob() {
  return trpc.jobs.retry.useMutation();
}

/**
 * Hook for removing a job.
 */
export function useRemoveJob() {
  return trpc.jobs.remove.useMutation();
}

/**
 * Hook for clearing completed jobs.
 */
export function useClearCompletedJobs() {
  return trpc.jobs.clearCompleted.useMutation();
}

/**
 * Hook for pausing a queue.
 */
export function usePauseQueue() {
  return trpc.jobs.pauseQueue.useMutation();
}

/**
 * Hook for resuming a queue.
 */
export function useResumeQueue() {
  return trpc.jobs.resumeQueue.useMutation();
}


