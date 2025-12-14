/**
 * Web video player component with hls.js integration.
 *
 * Features:
 * - HLS adaptive bitrate streaming
 * - Quality selection (auto and manual)
 * - Smooth quality switching
 * - Buffering state management
 * - Error recovery
 * - Picture-in-Picture support
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View, Image } from 'react-native';
import Hls from 'hls.js';
import type {
  PlayerState,
  PlayerError,
  QualityLevel,
  BufferedRange,
  PlayerHandle,
} from '@mediaserver/api-client';
import { createHlsConfig, getQualityLabel } from '../../lib/hls-config';

/**
 * Minimal playback logging - only errors and key events.
 * Set DEBUG_PLAYBACK=true in console to enable verbose logging.
 */
const DEBUG_PLAYBACK = typeof window !== 'undefined' && (window as unknown as { DEBUG_PLAYBACK?: boolean }).DEBUG_PLAYBACK === true;

function logPlayback(context: string, message: string, data?: Record<string, unknown>) {
  // Only log errors unconditionally
  if (context === 'Error' || context === 'HLS' && message.includes('error')) {
    console.error(`[Player:${context}]`, message, data || '');
    return;
  }
  // Log key events only in debug mode
  if (DEBUG_PLAYBACK) {
    console.log(`[Player:${context}]`, message, data ? JSON.stringify(data) : '');
  }
}

/** Props for the WebVideoPlayer component */
export interface WebVideoPlayerProps {
  /** HLS manifest URL or direct video URL */
  src: string;
  /** Poster image to show while loading */
  poster?: string;
  /** Starting time in seconds */
  startTime?: number;
  /** Known total duration from session (for accurate ended detection during live transcoding) */
  knownDuration?: number;
  /** Whether to auto-play */
  autoPlay?: boolean;
  /** Whether to use data saver mode */
  dataSaver?: boolean;
  /** Initial volume (0-1) */
  volume?: number;
  /** Initial muted state */
  muted?: boolean;
  /** Callback when state changes */
  onStateChange?: (state: Partial<PlayerState>) => void;
  /** Callback on time update */
  onTimeUpdate?: (time: number) => void;
  /** Callback when playback ends */
  onEnded?: () => void;
  /** Callback on error */
  onError?: (error: PlayerError) => void;
  /** Callback when qualities become available */
  onQualitiesAvailable?: (qualities: QualityLevel[]) => void;
  /** Callback when buffered ranges change */
  onBufferChange?: (ranges: BufferedRange[]) => void;
  /** CSS class name */
  className?: string;
}

/**
 * Convert video element error to PlayerError
 */
function toPlayerError(event: ErrorEvent | MediaError | null, retryCount = 0): PlayerError {
  if (!event) {
    return {
      code: 'unknown',
      message: 'Unknown error',
      fatal: true,
      retryable: true,
      retryCount,
    };
  }

  if (event instanceof MediaError) {
    switch (event.code) {
      case MediaError.MEDIA_ERR_NETWORK:
        return {
          code: 'network',
          message: 'Network error occurred',
          fatal: true,
          retryable: true,
          retryCount,
        };
      case MediaError.MEDIA_ERR_DECODE:
        return {
          code: 'decode',
          message: 'Decoding error occurred',
          fatal: true,
          retryable: false,
          retryCount,
        };
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        return {
          code: 'src_not_supported',
          message: 'Source not supported',
          fatal: true,
          retryable: false,
          retryCount,
        };
      case MediaError.MEDIA_ERR_ABORTED:
        return {
          code: 'aborted',
          message: 'Playback aborted',
          fatal: false,
          retryable: true,
          retryCount,
        };
      default:
        return {
          code: 'unknown',
          message: event.message || 'Unknown media error',
          fatal: true,
          retryable: true,
          retryCount,
        };
    }
  }

  return {
    code: 'unknown',
    message: (event as ErrorEvent).message || 'Unknown error',
    fatal: true,
    retryable: true,
    retryCount,
  };
}

/**
 * WebVideoPlayer component with hls.js integration.
 */
export const WebVideoPlayer = forwardRef<PlayerHandle, WebVideoPlayerProps>(
  (
    {
      src,
      poster,
      startTime = 0,
      knownDuration,
      autoPlay = false,
      dataSaver = false,
      volume = 1,
      muted = false,
      onStateChange,
      onTimeUpdate,
      onEnded,
      onError,
      onQualitiesAvailable,
      onBufferChange,
      className,
    },
    ref
  ) => {
    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const retryCountRef = useRef(0);
    const bufferingTimerRef = useRef<NodeJS.Timeout | null>(null);

    // State
    const [isHlsSupported] = useState(() => Hls.isSupported());
    const [, setShowBuffering] = useState(false);

    /**
     * Get buffered ranges from video element
     */
    const getBufferedRanges = useCallback((): BufferedRange[] => {
      const video = videoRef.current;
      if (!video) return [];

      const ranges: BufferedRange[] = [];
      for (let i = 0; i < video.buffered.length; i++) {
        ranges.push({
          start: video.buffered.start(i),
          end: video.buffered.end(i),
        });
      }
      return ranges;
    }, []);

    /**
     * Emit state change
     */
    const emitStateChange = useCallback(
      (partial: Partial<PlayerState>) => {
        onStateChange?.(partial);
      },
      [onStateChange]
    );

    /**
     * Initialize HLS.js
     */
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !src) {
        logPlayback('Init', 'Waiting for video element or src', { hasVideo: !!video, hasSrc: !!src });
        return undefined;
      }

      logPlayback('Init', 'Initializing player', { src, isHlsSupported });

      // Check if HLS is needed
      const isHlsStream = src.endsWith('.m3u8') || src.includes('m3u8');

      if (isHlsStream && isHlsSupported) {
        console.log('[HLS Init] Using hls.js for HLS stream', { src });
        
        // Initialize HLS.js with auth config (async)
        let mounted = true;
        createHlsConfig(dataSaver).then((config) => {
          try {
            console.log('[HLS Init] Config created, mounted:', mounted, 'video:', video);
            if (!mounted) {
              console.log('[HLS Init] Component unmounted, aborting');
              return;
            }
            
            console.log('[HLS Init] Creating HLS instance...');
            const hls = new Hls(config);
            console.log('[HLS Init] HLS created:', hls);
            hlsRef.current = hls;

            console.log('[HLS Init] Attaching to video element...');
            hls.attachMedia(video);
            console.log('[HLS Init] Loading source:', src);
            hls.loadSource(src);
            console.log('[HLS Init] Setup complete, waiting for events...');

          // Event handlers
          hls.on(Hls.Events.MANIFEST_LOADING, () => {
            logPlayback('HLS', 'Manifest loading...');
          });

          hls.on(Hls.Events.MANIFEST_LOADED, (_event, data) => {
            logPlayback('HLS', 'Manifest loaded', { 
              url: data.url,
              levels: data.levels?.length
            });
          });

          hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
            logPlayback('HLS', 'Manifest parsed', { levels: data.levels?.length });
            // Extract quality levels
            const qualities: QualityLevel[] = data.levels.map((level) => ({
              height: level.height,
              bitrate: level.bitrate,
              label: getQualityLabel(level.height),
            }));

            onQualitiesAvailable?.(qualities);

            // Auto-play if requested
            if (autoPlay) {
              video.play().catch(() => {
                // Autoplay blocked - will be handled by video events
              });
            }
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
            const level = hls.levels[data.level];
            if (level) {
              emitStateChange({
                currentQuality: {
                  height: level.height,
                  bitrate: level.bitrate,
                  label: getQualityLabel(level.height),
                },
              });
            }
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            logPlayback('HLS', 'HLS error event', { 
              type: data.type, 
              details: data.details, 
              fatal: data.fatal,
              url: data.url,
              reason: data.reason
            });

            if (data.fatal) {
              let errorCode: PlayerError['code'] = 'unknown';
              let retryable = true;

              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  errorCode = 'network';
                  logPlayback('HLS', 'Network error, attempting recovery', { retryCount: retryCountRef.current });
                  // Try to recover network error
                  if (retryCountRef.current < 3) {
                    retryCountRef.current++;
                    hls.startLoad();
                    return;
                  }
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  errorCode = 'decode';
                  logPlayback('HLS', 'Media error, attempting recovery', { retryCount: retryCountRef.current });
                  // Try to recover media error
                  if (retryCountRef.current < 3) {
                    retryCountRef.current++;
                    hls.recoverMediaError();
                    return;
                  }
                  break;
                default:
                  retryable = false;
              }

              const error: PlayerError = {
                code: errorCode,
                message: data.details || 'HLS error',
                fatal: true,
                retryable,
                retryCount: retryCountRef.current,
              };

              logPlayback('HLS', 'Fatal error after retries exhausted', { errorCode, message: data.details });
              emitStateChange({ status: 'error', error });
              onError?.(error);
            }
          });
          } catch (syncError) {
            console.error('[HLS Init] SYNC ERROR in .then() callback:', syncError);
          }
        }).catch((err) => {
          console.error('[HLS Init] Failed to initialize HLS config', err);
        });

        // Cleanup function
        return () => {
          mounted = false;
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = src;

        if (autoPlay) {
          video.play().catch(() => {
            // Autoplay blocked
          });
        }
      } else if (!isHlsStream) {
        // Direct playback (non-HLS)
        video.src = src;

        if (autoPlay) {
          video.play().catch(() => {
            // Autoplay blocked
          });
        }
      }

      return undefined;
    }, [src, isHlsSupported, dataSaver, autoPlay, onQualitiesAvailable, onError, emitStateChange]);

    /**
     * Set initial volume and muted state
     */
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      video.volume = volume;
      video.muted = muted;
    }, [volume, muted]);

    /**
     * Seek to start time when ready
     */
    useEffect(() => {
      const video = videoRef.current;
      if (!video || startTime <= 0) return;

      const handleLoadedMetadata = () => {
        video.currentTime = startTime;
      };

      if (video.readyState >= 1) {
        video.currentTime = startTime;
      } else {
        video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      }

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }, [startTime]);

    /**
     * Video event handlers
     */
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handlePlay = () => {
        logPlayback('Video', 'play event');
        emitStateChange({ status: 'playing' });
      };

      const handlePause = () => {
        logPlayback('Video', 'pause event');
        emitStateChange({ status: 'paused' });
      };

      const handleWaiting = () => {
        logPlayback('Video', 'waiting event (buffering)');
        // Delay showing buffering spinner (avoid flicker)
        bufferingTimerRef.current = setTimeout(() => {
          setShowBuffering(true);
          emitStateChange({ status: 'buffering' });
        }, 1000);
      };

      const handlePlaying = () => {
        logPlayback('Video', 'playing event');
        // Clear buffering timer
        if (bufferingTimerRef.current) {
          clearTimeout(bufferingTimerRef.current);
          bufferingTimerRef.current = null;
        }
        setShowBuffering(false);
        emitStateChange({ status: 'playing' });
      };

      const handleTimeUpdate = () => {
        onTimeUpdate?.(video.currentTime);
        emitStateChange({ currentTime: video.currentTime });
      };

      const handleDurationChange = () => {
        // For EVENT playlists (live transcoding), video.duration may be Infinity
        // or keep growing. Only update if we have a valid finite duration.
        const duration = video.duration;
        if (Number.isFinite(duration) && duration > 0) {
          logPlayback('Video', 'duration changed', { duration });
          emitStateChange({ duration });
        } else {
          logPlayback('Video', 'duration changed (ignored - invalid)', { duration });
        }
      };

      const handleVolumeChange = () => {
        emitStateChange({ volume: video.volume, muted: video.muted });
      };

      const handleEnded = () => {
        // During live transcoding (EVENT playlist), the video element fires 'ended' 
        // when it runs out of available segments, not when the actual video ends.
        // Only trigger ended state if we're actually near the known duration.
        const currentTime = video.currentTime;
        const actualDuration = knownDuration ?? video.duration;
        const isNearEnd = currentTime >= actualDuration - 10; // Within 10 seconds of end
        
        logPlayback('Video', 'ended event', { 
          currentTime, 
          knownDuration, 
          videoDuration: video.duration, 
          isNearEnd 
        });
        
        if (isNearEnd) {
          emitStateChange({ status: 'ended' });
          onEnded?.();
        } else {
          // Not actually at the end - likely ran out of transcoded segments.
          // Set to buffering state so the player keeps waiting for more content.
          logPlayback('Video', 'ended event ignored - not near actual end, setting buffering');
          emitStateChange({ status: 'buffering' });
        }
      };

      const handleError = () => {
        const error = toPlayerError(video.error, retryCountRef.current);
        logPlayback('Video', 'error event', { 
          code: error.code, 
          message: error.message,
          videoError: video.error?.code
        });
        emitStateChange({ status: 'error', error });
        onError?.(error);
      };

      const handleProgress = () => {
        const ranges = getBufferedRanges();
        onBufferChange?.(ranges);
      };

      const handleSeeking = () => {
        logPlayback('Video', 'seeking', { currentTime: video.currentTime });
        emitStateChange({ status: 'seeking' });
      };

      const handleSeeked = () => {
        logPlayback('Video', 'seeked', { currentTime: video.currentTime });
        emitStateChange({ status: video.paused ? 'paused' : 'playing' });
      };

      const handleLoadStart = () => {
        logPlayback('Video', 'loadstart event');
        emitStateChange({ status: 'loading' });
      };

      const handleCanPlay = () => {
        logPlayback('Video', 'canplay event', { readyState: video.readyState });
        if (video.paused) {
          emitStateChange({ status: 'ready' });
        }
      };

      // Add event listeners
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('durationchange', handleDurationChange);
      video.addEventListener('volumechange', handleVolumeChange);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('error', handleError);
      video.addEventListener('progress', handleProgress);
      video.addEventListener('seeking', handleSeeking);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('canplay', handleCanPlay);

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('durationchange', handleDurationChange);
        video.removeEventListener('volumechange', handleVolumeChange);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('error', handleError);
        video.removeEventListener('progress', handleProgress);
        video.removeEventListener('seeking', handleSeeking);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('canplay', handleCanPlay);

        if (bufferingTimerRef.current) {
          clearTimeout(bufferingTimerRef.current);
        }
      };
    }, [emitStateChange, onTimeUpdate, onEnded, onError, onBufferChange, getBufferedRanges, knownDuration]);

    /**
     * Expose imperative handle
     */
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          videoRef.current?.play();
        },
        pause: () => {
          videoRef.current?.pause();
        },
        seek: (time: number) => {
          if (videoRef.current) {
            videoRef.current.currentTime = time;
          }
        },
        setVolume: (vol: number) => {
          if (videoRef.current) {
            videoRef.current.volume = Math.max(0, Math.min(1, vol));
          }
        },
        setMuted: (m: boolean) => {
          if (videoRef.current) {
            videoRef.current.muted = m;
          }
        },
        setPlaybackRate: (rate: number) => {
          if (videoRef.current) {
            videoRef.current.playbackRate = rate;
          }
        },
        setQuality: (levelIndex: number | 'auto') => {
          if (hlsRef.current) {
            if (levelIndex === 'auto') {
              hlsRef.current.currentLevel = -1;
              emitStateChange({ autoQuality: true });
            } else {
              hlsRef.current.currentLevel = levelIndex;
              emitStateChange({ autoQuality: false });
            }
          }
        },
        enterFullscreen: () => {
          videoRef.current?.requestFullscreen?.();
        },
        exitFullscreen: () => {
          document.exitFullscreen?.();
        },
        enterPiP: async () => {
          if (videoRef.current && 'requestPictureInPicture' in videoRef.current) {
            await (videoRef.current as HTMLVideoElement).requestPictureInPicture();
            emitStateChange({ isPiP: true });
          }
        },
        exitPiP: async () => {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
            emitStateChange({ isPiP: false });
          }
        },
        reloadSource: async (newStartTime?: number) => {
          logPlayback('Reload', 'Reloading HLS source', { newStartTime, src });

          // Show loading state
          emitStateChange({ status: 'loading' });

          if (hlsRef.current && src && videoRef.current) {
            const hls = hlsRef.current;
            const video = videoRef.current;

            // Stop current playback
            hls.stopLoad();

            // Detach and destroy current HLS instance to clear all caches
            hls.detachMedia();
            hls.destroy();

            // Get fresh auth config with token
            const config = await createHlsConfig(dataSaver);
            const originalXhrSetup = config.xhrSetup;

            // Create a fresh HLS instance with auth + cache busting
            const newHls = new Hls({
              ...config,
              // Override xhrSetup to add both auth AND cache busting
              xhrSetup: (xhr: XMLHttpRequest, url: string) => {
                // Add timestamp to bust cache for segment requests
                const bustUrl = url.includes('?')
                  ? `${url}&_t=${Date.now()}`
                  : `${url}?_t=${Date.now()}`;
                // Re-open with the new URL (must be called before setRequestHeader)
                xhr.open('GET', bustUrl, true);
                
                // Now add auth headers from original config
                if (originalXhrSetup) {
                  originalXhrSetup(xhr, url);
                }
              },
            });

            hlsRef.current = newHls;

            // Set up error handling on new instance
            newHls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) {
                logPlayback('Error', 'HLS fatal error after reload', {
                  type: data.type,
                  details: data.details
                });
              }
            });

            // Attach to video element
            newHls.attachMedia(video);

            // Load the source
            newHls.loadSource(src);
            
            // Start from beginning of new epoch after manifest is parsed
            const onManifestParsed = () => {
              newHls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
              logPlayback('Reload', 'Manifest parsed, starting playback');
              video.currentTime = 0;
              video.play().catch(() => {
                // Autoplay might be blocked
              });
            };
            newHls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
            
          } else if (videoRef.current && !src.endsWith('.m3u8')) {
            // For non-HLS sources, just reload
            videoRef.current.load();
            if (newStartTime !== undefined) {
              videoRef.current.currentTime = newStartTime;
            }
          }
        },
      }),
      [emitStateChange, src]
    );

    return (
      <View className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Show poster while loading */}
        {poster && (
          <Image
            source={{ uri: poster }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 0,
            }}
            resizeMode="cover"
          />
        )}

        {/* Video element (using raw HTML for web) */}
        <video
          ref={videoRef}
          playsInline
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: 'black',
            zIndex: 1,
          }}
        />
      </View>
    );
  }
);

WebVideoPlayer.displayName = 'WebVideoPlayer';

export default WebVideoPlayer;

