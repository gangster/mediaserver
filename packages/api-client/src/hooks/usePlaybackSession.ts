/**
 * Comprehensive playback session hook.
 *
 * Manages the complete lifecycle of a playback session including:
 * - Session creation with retry logic
 * - Heartbeat for keeping session alive
 * - Progress tracking
 * - Resume position handling
 * - Audio/subtitle track switching
 * - Error recovery
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '../client.js';

/**
 * Minimal session logging - only errors.
 * Set DEBUG_PLAYBACK=true in console to enable verbose logging.
 */
const DEBUG_PLAYBACK = typeof globalThis !== 'undefined' && (globalThis as unknown as { DEBUG_PLAYBACK?: boolean }).DEBUG_PLAYBACK === true;

function logSession(context: string, message: string, data?: Record<string, unknown>) {
  // Only log errors unconditionally
  if (context === 'Error') {
    console.error(`[Session:${context}]`, message, data || '');
    return;
  }
  // Log other messages only in debug mode
  if (DEBUG_PLAYBACK) {
    console.log(`[Session:${context}]`, message, data ? JSON.stringify(data) : '');
  }
}

/** Session status */
export type SessionStatus = 'idle' | 'creating' | 'active' | 'error' | 'ended';

/** Session response from creating a playback session */
export interface CreateSessionResponse {
  sessionId: string;
  masterPlaylist: string;
  profile: string;
  directPlay: boolean;
  startPosition: number;
  /** Total duration of the media in seconds */
  duration: number;
}

/** Skip segments for intro/credits */
export interface SkipSegments {
  intro?: { start: number; end: number };
  credits?: { start: number; end: number };
}

/** Options for the playback session hook */
export interface UsePlaybackSessionOptions {
  /** Type of media */
  mediaType: 'movie' | 'episode';
  /** Media ID */
  mediaId: string;
  /** Starting position in seconds (optional, defaults to 0 or resume position) */
  startPosition?: number;
  /** Callback when session is ready */
  onSessionReady?: (session: CreateSessionResponse) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Whether to auto-create session on mount */
  autoCreate?: boolean;
  /** Heartbeat interval in milliseconds (default: 10000) */
  heartbeatIntervalMs?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Base retry delay in milliseconds (default: 1000) */
  retryDelayMs?: number;
}

/** Seek result from server */
export interface SeekResult {
  success: boolean;
  epochIndex: number;
  startPosition: number;
  transcodedTime: number;
}

/** Return type for the playback session hook */
export interface UsePlaybackSessionReturn {
  /** Current session data */
  session: CreateSessionResponse | null;
  /** Session status */
  status: SessionStatus;
  /** Error if any */
  error: Error | null;
  /** Saved position for resume prompt (null if no saved position or position < threshold) */
  savedPosition: number | null;
  /** Whether the saved position is still loading */
  isLoadingProgress: boolean;
  /** Current transcoded progress (how far FFmpeg has transcoded, in source file time) */
  transcodedTime: number;
  /** Whether a seek is currently in progress */
  isSeeking: boolean;

  // Actions
  /** Create a new session */
  createSession: (startPosition?: number) => Promise<void>;
  /** End the current session */
  endSession: () => Promise<void>;
  /** 
   * Seek to a new position (server-side). 
   * This triggers FFmpeg restart and waits for the first segment to be ready.
   * After this returns, call playerRef.current.reloadSource() to reload the playlist.
   */
  seek: (position: number) => Promise<SeekResult | null>;
  /** Report playback progress */
  reportProgress: (position: number, isPlaying: boolean) => void;
  /** Switch audio track */
  switchAudio: (trackIndex: number) => Promise<void>;
  /** Toggle or change subtitles */
  toggleSubtitles: (enabled: boolean, trackIndex?: number) => Promise<void>;
  /** Get skip segments for the media */
  skipSegments: SkipSegments | undefined;
}

/** Threshold for showing resume prompt (in seconds) */
const RESUME_THRESHOLD = 30;

/**
 * Hook for managing playback session lifecycle.
 */
export function usePlaybackSession(
  options: UsePlaybackSessionOptions
): UsePlaybackSessionReturn {
  const {
    mediaType,
    mediaId,
    startPosition: initialStartPosition,
    onSessionReady,
    onError,
    autoCreate = false,
    heartbeatIntervalMs = 10000,
    maxRetries = 3,
    retryDelayMs = 1000,
  } = options;

  // State
  const [session, setSession] = useState<CreateSessionResponse | null>(null);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  // Track whether we've started playback (to hide resume prompt after starting)
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const [transcodedTime, setTranscodedTime] = useState<number>(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Refs for heartbeat
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  // tRPC mutations
  const createSessionMutation = trpc.playback.createSession.useMutation();
  const heartbeatMutation = trpc.playback.heartbeat.useMutation();
  const endSessionMutation = trpc.playback.endSession.useMutation();
  const seekMutation = trpc.playback.seek.useMutation();

  // Query for existing watch progress (for resume)
  const { data: existingProgress, isLoading: isLoadingProgress } = trpc.playback.getProgress.useQuery(
    { mediaType, mediaId },
    { enabled: !!mediaId }
  );

  // Query for skip segments
  const { data: skipSegments } = trpc.playback.getSkipSegments.useQuery(
    { mediaType, mediaId },
    { enabled: !!mediaId }
  );

  // Compute saved position from existing progress (memoized to avoid recalculation)
  // This is computed directly rather than via useEffect to avoid race conditions
  // Returns null if playback has already started (to hide resume prompt)
  const computedSavedPosition = useMemo(() => {
    // Don't show resume prompt after playback has started
    if (playbackStarted) return null;
    
    if (existingProgress && existingProgress.position > RESUME_THRESHOLD) {
      // Don't show resume if nearly complete (> 90%)
      if (existingProgress.percentage < 90) {
        return existingProgress.position;
      }
    }
    return null;
  }, [existingProgress, playbackStarted]);

  /**
   * Create a playback session with retry logic.
   */
  const createSession = useCallback(
    async (startPos?: number) => {
      const position = startPos ?? initialStartPosition ?? 0;
      let lastError: Error | null = null;

      logSession('Create', 'Starting session creation', { mediaType, mediaId, position });
      setStatus('creating');
      setError(null);

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          logSession('Create', `Attempt ${attempt + 1}/${maxRetries}`);
          const result = await createSessionMutation.mutateAsync({
            mediaType,
            mediaId,
            startPosition: position,
          });

          logSession('Create', 'Session created', { 
            sessionId: result.sessionId,
            masterPlaylist: result.masterPlaylist,
            directPlay: result.directPlay
          });

          setSession(result);
          setStatus('active');
          lastPositionRef.current = position;
          
          // Initialize transcodedTime to the start position
          // FFmpeg has already transcoded at least this far (since we wait for first segment)
          setTranscodedTime(position);
          
          onSessionReady?.(result);

          // Mark playback as started to hide resume prompt
          setPlaybackStarted(true);

          return;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Failed to create session');
          logSession('Create', `Attempt ${attempt + 1} failed`, { 
            error: lastError.message
          });

          // Wait before retry (exponential backoff)
          if (attempt < maxRetries - 1) {
            const delay = retryDelayMs * Math.pow(2, attempt);
            logSession('Create', `Retrying in ${delay}ms`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // All retries failed
      logSession('Create', 'All retries exhausted', { error: lastError?.message });
      setStatus('error');
      setError(lastError);
      onError?.(lastError!);
    },
    [
      mediaType,
      mediaId,
      initialStartPosition,
      maxRetries,
      retryDelayMs,
      createSessionMutation,
      onSessionReady,
      onError,
    ]
  );

  /**
   * End the current session.
   */
  const endSession = useCallback(async () => {
    logSession('End', 'Ending session', { sessionId: session?.sessionId });
    
    // Stop heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (session?.sessionId) {
      try {
        await endSessionMutation.mutateAsync({ sessionId: session.sessionId });
        logSession('End', 'Session ended on server');
      } catch (err) {
        logSession('End', 'Failed to end session on server (non-fatal)', { 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      }
    }

    setSession(null);
    setStatus('ended');
  }, [session?.sessionId, endSessionMutation]);

  /**
   * Seek to a new position (server-side).
   * This triggers FFmpeg restart and waits for the first segment to be ready.
   * After this returns, the caller should reload the HLS source.
   * 
   * If the session has expired (e.g., server restart), this will automatically
   * recreate the session at the seek position and return null. The caller should
   * then wait for the new session to be ready.
   */
  const seek = useCallback(
    async (position: number): Promise<SeekResult | null> => {
      if (!session?.sessionId) {
        logSession('Seek', 'No active session for seek');
        return null;
      }

      logSession('Seek', 'Starting server-side seek', { sessionId: session.sessionId, position });
      setIsSeeking(true);

      try {
        const result = await seekMutation.mutateAsync({
          sessionId: session.sessionId,
          position,
        });

        logSession('Seek', 'Server-side seek completed', {
          epochIndex: result.epochIndex,
          startPosition: result.startPosition,
          transcodedTime: result.transcodedTime,
        });

        // Update transcoded time
        setTranscodedTime(result.transcodedTime);
        setIsSeeking(false);

        return result;
      } catch (err: unknown) {
        setIsSeeking(false);
        
        // Check if this is a session expired error (PRECONDITION_FAILED)
        // This happens when the server restarted and lost the in-memory session
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isSessionExpired = 
          errorMessage.includes('expired') || 
          errorMessage.includes('Session not found') ||
          (err && typeof err === 'object' && 'data' in err && 
           (err as { data?: { code?: string } }).data?.code === 'PRECONDITION_FAILED');
        
        if (isSessionExpired) {
          logSession('Seek', 'Session expired, recreating at seek position', { position });
          // Clear current session and recreate at the seek position
          setSession(null);
          setStatus('creating');
          // Recreate session at the seek position - this will trigger a new session
          // The caller should wait for onSessionReady callback
          await createSession(position);
          return null; // Return null to indicate session was recreated
        }
        
        logSession('Seek', 'Server-side seek failed', { error: errorMessage });
        throw err;
      }
    },
    [session?.sessionId, seekMutation, createSession]
  );

  /**
   * Report playback progress (debounced via heartbeat).
   */
  const reportProgress = useCallback((position: number, isPlaying: boolean) => {
    lastPositionRef.current = position;
    isPlayingRef.current = isPlaying;
  }, []);

  /**
   * Switch audio track.
   */
  const switchAudio = useCallback(
    async (trackIndex: number) => {
      // TODO: Implement audio track switching via session
      // This would typically require creating a new transcoding job
      // or switching to a different audio stream in the HLS manifest
      logSession('Audio', 'Switching audio track', { trackIndex });
    },
    []
  );

  /**
   * Toggle or change subtitles.
   */
  const toggleSubtitles = useCallback(
    async (enabled: boolean, trackIndex?: number) => {
      // TODO: Implement subtitle toggling
      // This could be client-side if we have WebVTT files
      // or server-side if burning in subtitles
      logSession('Subtitles', 'Toggling subtitles', { enabled, trackIndex });
    },
    []
  );

  // Start heartbeat when session is active
  useEffect(() => {
    if (status !== 'active' || !session?.sessionId) {
      return;
    }

    logSession('Heartbeat', 'Starting heartbeat', { 
      sessionId: session.sessionId, 
      intervalMs: heartbeatIntervalMs 
    });

    // Start heartbeat interval
    heartbeatIntervalRef.current = setInterval(async () => {
      try {
        const result = await heartbeatMutation.mutateAsync({
          sessionId: session.sessionId,
          position: lastPositionRef.current,
          isPlaying: isPlayingRef.current,
          buffering: false,
        });
        
        // Update transcoded time if server provides it
        // This helps the client make better local vs server seek decisions
        if (result?.transcodedTime !== undefined) {
          setTranscodedTime(result.transcodedTime);
        }
        
        // Check if server indicates the session is no longer active
        // This can happen after server restart when DB record exists but memory doesn't
        if (result && !result.sessionActive) {
          logSession('Heartbeat', 'Session no longer active (server restart?), recreating');
          // Recreate session at current position
          const currentPosition = lastPositionRef.current;
          setSession(null);
          setStatus('creating');
          await createSession(currentPosition);
        }
      } catch (err) {
        logSession('Heartbeat', 'Heartbeat failed', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }, heartbeatIntervalMs);

    return () => {
      logSession('Heartbeat', 'Stopping heartbeat');
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [status, session?.sessionId, heartbeatIntervalMs, heartbeatMutation, createSession]);

  // Auto-create session on mount if enabled
  useEffect(() => {
    if (autoCreate && status === 'idle') {
      createSession();
    }
  }, [autoCreate, status, createSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      // Note: We don't call endSession here because the component
      // might be unmounting due to navigation, and the user might
      // want to resume later. Session cleanup is handled by server-side
      // stale session expiration.
    };
  }, []);

  return {
    session,
    status,
    error,
    // Use computed value to avoid race conditions with state update
    savedPosition: computedSavedPosition,
    isLoadingProgress,
    transcodedTime,
    isSeeking,
    createSession,
    endSession,
    seek,
    reportProgress,
    switchAudio,
    toggleSubtitles,
    skipSegments,
  };
}
