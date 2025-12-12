/**
 * Job-related hooks for managing background jobs.
 */

import { trpc } from '../client.js';

/**
 * Hook for listing jobs with pagination and filters.
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
  });
}

/**
 * Hook for getting a single job by ID.
 */
export function useJob(id: string, enabled = true) {
  return trpc.jobs.get.useQuery({ id }, { enabled });
}

/**
 * Hook for getting active jobs (for dashboard).
 */
export function useActiveJobs() {
  return trpc.jobs.active.useQuery(undefined, {
    refetchInterval: 5000, // Refetch every 5 seconds
  });
}

/**
 * Hook for getting queue statistics.
 */
export function useJobStats() {
  return trpc.jobs.stats.useQuery(undefined, {
    refetchInterval: 10000, // Refetch every 10 seconds
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

