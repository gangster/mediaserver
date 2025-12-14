/**
 * Main video player container component.
 *
 * Brings together all player components:
 * - WebVideoPlayer (or NativeVideoPlayer)
 * - PlayerControls
 * - PlayerOverlay
 * - Keyboard shortcuts
 * - Session management
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  usePlaybackSession,
  usePlayerControls,
  type PlayerHandle,
} from '@mediaserver/api-client';
import { WebVideoPlayer } from './WebVideoPlayer';
import { PlayerControls } from './PlayerControls';
import { PlayerOverlay, type NextEpisode } from './PlayerOverlay';
import type { TrickplayData } from './ProgressBar';
import { getApiUrl } from '../../lib/config';

/**
 * Minimal playback logging - only errors and key events.
 * Set DEBUG_PLAYBACK=true in console to enable verbose logging.
 */
const DEBUG_PLAYBACK = typeof window !== 'undefined' && (window as unknown as { DEBUG_PLAYBACK?: boolean }).DEBUG_PLAYBACK === true;

function logPlayback(context: string, message: string, data?: Record<string, unknown>) {
  // Only log errors unconditionally
  if (context === 'Error') {
    console.error(`[VideoPlayer:${context}]`, message, data || '');
    return;
  }
  // Log other messages only in debug mode
  if (DEBUG_PLAYBACK) {
    console.log(`[VideoPlayer:${context}]`, message, data ? JSON.stringify(data) : '');
  }
}

/** Props for the VideoPlayer component */
export interface VideoPlayerProps {
  /** Media type */
  mediaType: 'movie' | 'episode';
  /** Media ID */
  mediaId: string;
  /** Title to display */
  title?: string;
  /** Poster/thumbnail URL */
  posterUrl?: string;
  /** Next episode info (for TV shows) */
  nextEpisode?: NextEpisode | null;
  /** Whether to auto-play */
  autoPlay?: boolean;
  /** Start position in seconds (overrides resume position) */
  startPosition?: number;
  /** Callback when back button is pressed */
  onBack?: () => void;
  /** Callback when next episode should play */
  onNextEpisode?: () => void;
  /** Callback when playback ends (movies) */
  onEnded?: () => void;
}

/**
 * Main video player component.
 */
export function VideoPlayer({
  mediaType,
  mediaId,
  title,
  posterUrl,
  nextEpisode,
  autoPlay = true,
  startPosition,
  onBack,
  onNextEpisode,
  onEnded,
}: VideoPlayerProps) {
  // Player handle ref
  const playerRef = useRef<PlayerHandle>(null);

  // Control visibility state
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Next episode cancelled
  const [nextEpisodeCancelled, setNextEpisodeCancelled] = useState(false);

  // Session management
  const {
    session,
    status: sessionStatus,
    error: sessionError,
    savedPosition,
    isLoadingProgress,
    transcodedTime,
    isSeeking,
    createSession,
    endSession,
    seek: serverSeek,
    reportProgress,
    skipSegments,
  } = usePlaybackSession({
    mediaType,
    mediaId,
    startPosition,
    autoCreate: false, // We'll create manually after handling resume
    onSessionReady: (s) => {
      logPlayback('Session', 'Session ready', { 
        sessionId: s.sessionId, 
        masterPlaylist: s.masterPlaylist,
        directPlay: s.directPlay,
        startPosition: s.startPosition 
      });
    },
    onError: (err) => {
      logPlayback('Session', 'Session error', { error: err.message });
    },
  });
  
  // Log session status changes
  useEffect(() => {
    logPlayback('Session', `Status: ${sessionStatus}`, { 
      hasSession: !!session,
      sessionId: session?.sessionId,
      masterPlaylist: session?.masterPlaylist,
      error: sessionError?.message
    });
  }, [sessionStatus, session, sessionError]);

  // Player state management
  const {
    state: playerState,
    setStatus,
    setCurrentTime,
    setDuration,
    setBuffered,
    setVolume,
    setMuted,
    setFullscreen,
    setPiP,
    setCurrentQuality,
    setAvailableQualities,
    setAutoQuality,
    setError,
    clearError,
    isPlaying,
    isLoading,
    isBuffering,
    hasEnded,
    hasError,
    playerRef: controlsPlayerRef,
  } = usePlayerControls({
    initialVolume: 1,
    initialMuted: false,
  });

  // Trickplay data (placeholder - would be fetched from server)
  const [trickplayData, setTrickplayData] = useState<TrickplayData | null>(null);

  // Share player ref between controls and this component
  useEffect(() => {
    controlsPlayerRef.current = playerRef.current;
  }, [controlsPlayerRef, playerRef.current]);

  /**
   * Track the authoritative duration from the session.
   * This is the actual video length from media probe, not HLS.js's progressive estimate.
   */
  const knownDurationRef = useRef<number | null>(null);
  
  /**
   * Track the epoch offset for transcoded streams.
   * After a server-side seek, the HLS playlist restarts at time 0, but this offset
   * tells us what source-file time that corresponds to.
   * 
   * Example: If we seek to 30:00 (1800s), the new epoch starts at video time 0
   * but epochOffset = 1800, so displayed time = 0 + 1800 = 1800s.
   */
  const epochOffsetRef = useRef<number>(0);
  
  /**
   * Initialize session on mount.
   * Uses a ref to prevent duplicate calls due to React Strict Mode or dependency changes.
   * Waits for progress query to complete so we can use savedPosition for resume.
   */
  const sessionInitialized = useRef(false);
  
  useEffect(() => {
    // Wait for progress query to complete before creating session
    if (isLoadingProgress) return;
    
    // Only create session once per mount
    if (sessionInitialized.current) return;
    sessionInitialized.current = true;
    
    // Reset known duration for new media
    knownDurationRef.current = null;
    
    // If there's a saved position and no explicit start position, use it
    if (savedPosition && !startPosition) {
      logPlayback('Session', 'Creating session with saved position (resume)', { savedPosition });
      createSession(savedPosition);
    } else {
      logPlayback('Session', 'Creating session', { startPosition: startPosition ?? 0 });
      createSession(startPosition ?? 0);
    }

    return () => {
      sessionInitialized.current = false;
      knownDurationRef.current = null;
      endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run only on mount or when progress loads
  }, [mediaId, mediaType, isLoadingProgress]);
  
  /**
   * Set duration from session when available.
   * Also initialize epoch offset from session's start position.
   */
  useEffect(() => {
    // Cast to access duration (added in API, types may not be updated yet)
    const sessionDuration = (session as { duration?: number } | null)?.duration;
    if (sessionDuration && sessionDuration > 0) {
      knownDurationRef.current = sessionDuration;
      setDuration(sessionDuration);
      logPlayback('Duration', 'Set authoritative duration from session', { sessionDuration });
    }
    
    // Initialize epoch offset from session's start position
    // This handles resuming from a saved position
    if (session?.startPosition !== undefined) {
      epochOffsetRef.current = session.startPosition;
      logPlayback('Epoch', 'Initial epoch offset from session', { epochOffset: session.startPosition });
    }
  }, [session, setDuration]);

  /**
   * Fetch trickplay data when session is ready.
   */
  useEffect(() => {
    if (!session) return;

    // Fetch trickplay metadata
    const fetchTrickplay = async () => {
      try {
        const response = await fetch(
          getApiUrl(`/api/trickplay/${mediaType}/${mediaId}/metadata.json`)
        );
        if (response.ok) {
          const data = await response.json();
          setTrickplayData({
            ...data,
            spriteUrl: getApiUrl(`/api/trickplay/${mediaType}/${mediaId}/sprite.jpg`),
          });
        }
      } catch {
        // Trickplay not available, that's fine
      }
    };

    fetchTrickplay();
  }, [session, mediaType, mediaId]);

  /**
   * Handle time updates from video player.
   * Adds epoch offset to convert video element time to source file time.
   */
  const handleTimeUpdate = useCallback(
    (time: number) => {
      // Add epoch offset to get source file time
      const sourceTime = time + epochOffsetRef.current;
      setCurrentTime(sourceTime);
      reportProgress(sourceTime, isPlaying);
    },
    [setCurrentTime, reportProgress, isPlaying]
  );

  /**
   * Handle state changes from video player.
   * 
   * NOTE: Duration updates from HLS.js are IGNORED once we have the authoritative
   * duration from the session. HLS.js reports progressive duration as segments are
   * loaded, which causes the progress bar to jump around. We use the probe duration.
   */
  const handleStateChange = useCallback(
    (partial: Partial<typeof playerState>) => {
      if (partial.status !== undefined) setStatus(partial.status);
      
      // Add epoch offset to convert video element time to source file time
      if (partial.currentTime !== undefined) {
        const sourceTime = partial.currentTime + epochOffsetRef.current;
        setCurrentTime(sourceTime);
      }

      // Only accept duration updates if we don't have an authoritative duration yet
      // This prevents HLS.js from overwriting the known duration with partial values
      if (partial.duration !== undefined && knownDurationRef.current === null) {
        logPlayback('Duration', 'Accepting duration from HLS (no session duration yet)', { duration: partial.duration });
        setDuration(partial.duration);
      }

      if (partial.volume !== undefined) setVolume(partial.volume);
      if (partial.muted !== undefined) setMuted(partial.muted);
      if (partial.isFullscreen !== undefined) setFullscreen(partial.isFullscreen);
      if (partial.isPiP !== undefined) setPiP(partial.isPiP);
      if (partial.currentQuality !== undefined) setCurrentQuality(partial.currentQuality);
      if (partial.autoQuality !== undefined) setAutoQuality(partial.autoQuality);
      if (partial.error !== undefined) setError(partial.error);
    },
    [
      setStatus,
      setCurrentTime,
      setDuration,
      setVolume,
      setMuted,
      setFullscreen,
      setPiP,
      setCurrentQuality,
      setAutoQuality,
      setError,
    ]
  );

  /**
   * Handle seek.
   * For transcoded content, this may trigger a server-side seek if jumping beyond
   * what's been transcoded. Otherwise, it's a local seek handled by hls.js.
   * 
   * @param time - Target time in SOURCE FILE time (not video element time)
   */
  const handleSeek = useCallback(
    async (time: number) => {
      // For direct play sessions, just do a local seek
      if (session?.directPlay) {
        playerRef.current?.seek(time);
        return;
      }

      // Check if we need a server-side seek
      // We need server-side seek if:
      // 1. Seeking forward significantly (more than a few segments ahead of what's transcoded)
      // 2. The target time is beyond the transcoded progress
      const currentSourceTime = playerState.currentTime; // Already in source time (includes epoch offset)
      const safeBufferAhead = 30; // seconds - if we're within this range of transcoded time, local seek should work
      const epochOffset = epochOffsetRef.current;

      // Calculate what video element time this would be (for local seeks)
      const targetVideoTime = time - epochOffset;
      
      // Check if the target is within the current epoch (>= 0 in video time)
      // and within what's been transcoded
      const isWithinCurrentEpoch = targetVideoTime >= 0;
      const isWithinTranscodedRange = time <= transcodedTime + safeBufferAhead;
      
      // If seeking within current epoch and within transcoded range, try local seek
      if (isWithinCurrentEpoch && (time <= currentSourceTime || isWithinTranscodedRange)) {
        logPlayback('Seek', 'Local seek (within current epoch)', { 
          targetSourceTime: time,
          targetVideoTime,
          currentSourceTime, 
          epochOffset,
          transcodedTime,
          safeBufferAhead 
        });
        playerRef.current?.seek(targetVideoTime);
        return;
      }

      // Need server-side seek for jumping to a different position
      logPlayback('Seek', 'Server-side seek (new epoch required)', { 
        targetSourceTime: time, 
        currentSourceTime, 
        epochOffset,
        transcodedTime,
        isWithinCurrentEpoch,
        isWithinTranscodedRange
      });

      try {
        // Call server to restart transcode at new position
        const result = await serverSeek(time);
        
        if (result?.success) {
          // Update epoch offset to the new start position
          epochOffsetRef.current = result.startPosition;
          
          logPlayback('Seek', 'Server seek completed, reloading HLS', { 
            epochIndex: result.epochIndex,
            newEpochOffset: result.startPosition 
          });
          
          // Reload the HLS source to pick up the new playlist
          // The server has created a new epoch starting at the seek position
          playerRef.current?.reloadSource(0); // Start at beginning of new epoch
        }
      } catch (err) {
        logPlayback('Error', 'Server seek failed', { 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
        // Fall back to local seek if possible (might work if content is buffered)
        const fallbackVideoTime = time - epochOffset;
        if (fallbackVideoTime >= 0) {
          playerRef.current?.seek(fallbackVideoTime);
        }
      }
    },
    [session?.directPlay, playerState.currentTime, transcodedTime, serverSeek]
  );

  /**
   * Handle playback ended.
   */
  const handleEnded = useCallback(() => {
    setStatus('ended');
    if (mediaType === 'movie') {
      onEnded?.();
    }
  }, [setStatus, mediaType, onEnded]);

  /**
   * Handle retry after error.
   */
  const handleRetry = useCallback(() => {
    clearError();
    createSession(playerState.currentTime);
  }, [clearError, createSession, playerState.currentTime]);

  /**
   * Handle replay (start from beginning).
   */
  const handleReplay = useCallback(() => {
    handleSeek(0);
    playerRef.current?.play();
  }, [handleSeek]);

  /**
   * Handle next episode.
   */
  const handleNextEpisode = useCallback(() => {
    if (!nextEpisodeCancelled) {
      onNextEpisode?.();
    }
  }, [nextEpisodeCancelled, onNextEpisode]);

  /**
   * Cancel next episode countdown.
   */
  const handleCancelNextEpisode = useCallback(() => {
    setNextEpisodeCancelled(true);
  }, []);

  /**
   * Show controls and reset hide timer.
   */
  const showControlsWithTimer = useCallback(() => {
    setShowControls(true);

    // Clear existing timer
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    // Hide after 3 seconds if playing
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  /**
   * Handle mouse movement to show controls.
   */
  const handleMouseMove = useCallback(() => {
    showControlsWithTimer();
  }, [showControlsWithTimer]);

  // Keep controls visible when paused
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [isPlaying]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Build stream URL with full API base (HLS.js needs absolute URLs)
  const streamUrl = session?.masterPlaylist ? getApiUrl(session.masterPlaylist) : '';

  // TEMPORARY DEBUG - Remove after fixing
  console.log('[VideoPlayer DEBUG]', {
    sessionStatus,
    hasSession: !!session,
    sessionId: session?.sessionId,
    masterPlaylist: session?.masterPlaylist,
    streamUrl,
    playerStatus: playerState.status,
    isLoading,
    isBuffering,
  });

  // Build children array to avoid whitespace text nodes
  const children = [];
  
  // Video player
  // For transcoded content (non-direct-play), startTime is always 0 because FFmpeg
  // already started transcoding from the resume position. The epochOffset handles
  // display time translation. For direct play, we use the actual startPosition.
  if (streamUrl) {
    children.push(
      <WebVideoPlayer
        key="player"
        ref={playerRef}
        src={streamUrl}
        poster={posterUrl}
        startTime={session?.directPlay ? (session?.startPosition ?? 0) : 0}
        knownDuration={knownDurationRef.current ?? undefined}
        autoPlay={autoPlay}
        volume={playerState.volume}
        muted={playerState.muted}
        onStateChange={handleStateChange}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={setError}
        onQualitiesAvailable={setAvailableQualities}
        onBufferChange={setBuffered}
        className="absolute inset-0"
      />
    );
  }
  
  // Overlay (loading, error, end)
  children.push(
    <PlayerOverlay
      key="overlay"
      isLoading={isLoading || sessionStatus === 'creating' || isSeeking}
      isBuffering={isBuffering}
      hasEnded={hasEnded}
      error={hasError ? playerState.error : undefined}
      mediaType={mediaType}
      title={title}
      nextEpisode={nextEpisodeCancelled ? null : nextEpisode}
      onRetry={handleRetry}
      onReplay={handleReplay}
      onNextEpisode={handleNextEpisode}
      onCancelNextEpisode={handleCancelNextEpisode}
      onBack={onBack}
    />
  );
  
  // Controls (shown/hidden based on activity)
  if (showControls && !hasEnded && !hasError) {
    children.push(
      <PlayerControls
        key="controls"
        isPlaying={isPlaying}
        isLoading={isLoading}
        currentTime={playerState.currentTime}
        duration={playerState.duration}
        bufferedRanges={playerState.bufferedRanges}
        volume={playerState.volume}
        muted={playerState.muted}
        playbackRate={playerState.playbackRate}
        isFullscreen={playerState.isFullscreen}
        isPiP={playerState.isPiP}
        autoQuality={playerState.autoQuality}
        currentQuality={playerState.currentQuality}
        availableQualities={playerState.availableQualities}
        trickplay={trickplayData}
        intro={skipSegments?.intro}
        credits={skipSegments?.credits}
        title={title}
        playerRef={playerRef}
        onBack={onBack}
        onSeek={handleSeek}
      />
    );
  }

  return (
    <View
      className="relative w-full h-full bg-black"
      // @ts-expect-error - Web-only event
      onMouseMove={handleMouseMove}
    >{children}</View>
  );
}

export default VideoPlayer;
