/**
 * Playback and watch progress hooks.
 */

import { trpc } from '../client.js';

/**
 * Hook for getting watch progress.
 */
export function useWatchProgress(
  mediaType: 'movie' | 'episode',
  mediaId: string,
  enabled = true
) {
  return trpc.playback.getProgress.useQuery({ mediaType, mediaId }, { enabled });
}

/**
 * Hook for updating watch progress.
 */
export function useUpdateProgress() {
  return trpc.playback.updateProgress.useMutation();
}

/**
 * Hook for creating a playback session.
 */
export function useCreateSession() {
  return trpc.playback.createSession.useMutation();
}

/**
 * Hook for session heartbeat.
 */
export function useSessionHeartbeat() {
  return trpc.playback.heartbeat.useMutation();
}

/**
 * Hook for ending a playback session.
 */
export function useEndSession() {
  return trpc.playback.endSession.useMutation();
}

/**
 * Hook for continue watching items.
 */
export function useContinueWatching(limit = 10) {
  return trpc.playback.continueWatching.useQuery({ limit });
}

/**
 * Hook for recently watched items.
 */
export function useRecentlyWatched(limit = 10) {
  return trpc.playback.recentlyWatched.useQuery({ limit });
}

/**
 * Hook for active playback sessions (admin).
 */
export function useActiveSessions() {
  return trpc.playback.activeSessions.useQuery();
}


