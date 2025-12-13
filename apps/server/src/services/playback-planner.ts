/**
 * PlaybackPlan Decision Engine
 *
 * The core decision engine that creates a PlaybackPlan from:
 * - Media probe result
 * - Client capabilities
 * - Server capabilities
 * - User preferences
 *
 * Implements the 7-tier playback hierarchy:
 * 1. Direct Play
 * 2. Direct Play + Audio Transcode
 * 3. Remux
 * 4. Remux + Audio Transcode
 * 5. Remux-to-HLS
 * 6. Remux-to-HLS + Audio Transcode
 * 7. Transcode-to-HLS
 *
 * @see docs/TRANSCODING_PIPELINE.md §6 for specification
 */

import { randomUUID } from 'node:crypto';
import type {
  PlaybackPlan,
  PlaybackMode,
  PlaybackTransport,
  ContainerFormat,
  VideoTrackPlan,
  AudioTrackPlan,
  SubtitlePlan,
  HDRPlan,
  ContentQuirksPlan,
  PlaybackModifications,
  SegmentConfig,
  PlaybackReasonCode,
  PlaybackInvariant,
  MediaProbeResult,
  ClientCapabilities,
  ServerCapabilities,
  VideoStreamInfo,
  AudioStreamInfo,
  SubtitleStreamInfo,
  HDRFormat,
  HDRMode,
  TrackAction,
  VideoCodec,
  AudioCodec,
  AudioNormalization,
} from '@mediaserver/core';
import {
  clientSupportsVideoCodec,
  clientSupportsAudioCodec,
  clientSupportsHDR,
  getMaxResolutionDimensions,
} from './client-capabilities.js';
import {
  getBestH264Encoder,
  getDeinterlaceFilter,
  getToneMapFilter,
  hasFilter,
} from './ffmpeg-capabilities.js';
import { logger } from '../lib/logger.js';

/** Maximum keyframe interval for remux-to-HLS (seconds) */
const MAX_KEYFRAME_INTERVAL_FOR_REMUX_HLS = 8;

/** User preferences that affect playback decisions */
export interface UserPlaybackPreferences {
  preferredAudioLanguage?: string;
  preferredSubtitleLanguage?: string;
  forceSubtitles?: boolean;
  burnInSubtitles?: boolean;
  maxBitrate?: number;
  maxResolution?: '4k' | '1080p' | '720p' | '480p';
  preferHDR?: boolean;
  audioNormalization?: AudioNormalization;
}

/** Context for playback planning */
export interface PlaybackPlanContext {
  sessionId: string;
  userId: string;
  mediaId: string;
  media: MediaProbeResult;
  client: ClientCapabilities;
  server: ServerCapabilities;
  preferences: UserPlaybackPreferences;
  startPosition?: number;
  playbackSpeed?: number;
  isRemoteAccess?: boolean;
}

/**
 * Create a PlaybackPlan for the given context.
 *
 * This is the main entry point for the decision engine.
 */
export function createPlaybackPlan(ctx: PlaybackPlanContext): PlaybackPlan {
  const startTime = Date.now();
  const reasonCodes: PlaybackReasonCode[] = [];
  const decisionPath: string[] = [];

  logger.info(
    { sessionId: ctx.sessionId, mediaId: ctx.mediaId },
    'Creating playback plan'
  );

  // Select tracks
  const videoStream = selectVideoStream(ctx.media);
  const audioStream = selectAudioStream(ctx.media, ctx.preferences);
  const subtitleStream = selectSubtitleStream(ctx.media, ctx.preferences);

  if (!videoStream) {
    throw new Error('No video stream found in media');
  }

  decisionPath.push(`Selected video stream ${videoStream.index}`);
  if (audioStream) {
    decisionPath.push(`Selected audio stream ${audioStream.index} (${audioStream.language ?? 'unknown'})`);
  }
  if (subtitleStream) {
    decisionPath.push(`Selected subtitle stream ${subtitleStream.index}`);
  }

  // Determine video compatibility
  const videoCompatibility = analyzeVideoCompatibility(
    videoStream,
    ctx.client,
    ctx.server,
    ctx.preferences
  );
  reasonCodes.push(...videoCompatibility.reasons);
  decisionPath.push(...videoCompatibility.decisions);

  // Determine audio compatibility
  const audioCompatibility = audioStream
    ? analyzeAudioCompatibility(audioStream, ctx.client)
    : { needsTranscode: false, needsRemux: false, reasons: [] as PlaybackReasonCode[], decisions: [] as string[] };
  reasonCodes.push(...audioCompatibility.reasons);
  decisionPath.push(...audioCompatibility.decisions);

  // Determine transport (Range vs HLS)
  const transport = determineTransport(ctx, videoCompatibility);
  decisionPath.push(`Transport: ${transport}`);

  // Determine playback mode based on compatibility analysis
  const mode = determinePlaybackMode(
    videoCompatibility,
    audioCompatibility,
    transport,
    ctx
  );
  decisionPath.push(`Mode: ${mode}`);

  // Build component plans
  const videoPlan = buildVideoPlan(
    videoStream,
    videoCompatibility,
    mode,
    ctx
  );

  const audioPlan = audioStream
    ? buildAudioPlan(audioStream, audioCompatibility, mode, ctx)
    : buildSilentAudioPlan();

  const subtitlePlan = buildSubtitlePlan(
    subtitleStream,
    ctx.preferences,
    mode
  );

  const hdrPlan = buildHDRPlan(
    videoStream,
    videoCompatibility,
    ctx.client,
    ctx.server
  );
  if (hdrPlan.mode !== 'passthrough') {
    reasonCodes.push(getHDRReasonCode(hdrPlan.mode));
  }

  const quirksPlan = buildQuirksPlan(ctx.media.contentQuirks, ctx.server);
  if (quirksPlan.deinterlace) {
    reasonCodes.push('DEINTERLACE_REQUIRED');
    decisionPath.push(`Deinterlace: ${quirksPlan.deinterlace.filter}`);
  }
  if (quirksPlan.vfrToCfr) {
    reasonCodes.push('VFR_CONVERSION_REQUIRED');
    decisionPath.push(`VFR→CFR: ${quirksPlan.vfrToCfr.targetFps}fps`);
  }

  // Container format
  const container = determineContainer(mode, transport);

  // Segment configuration
  const segmentConfig = determineSegmentConfig(ctx);

  // Playback modifications
  const modifications: PlaybackModifications = {
    speed: ctx.playbackSpeed ?? 1.0,
    audioNormalization: ctx.preferences.audioNormalization ?? 'off',
  };

  if (modifications.speed !== 1.0) {
    reasonCodes.push('SPEED_CHANGE_ACTIVE');
  }
  if (modifications.audioNormalization !== 'off') {
    reasonCodes.push('AUDIO_NORMALIZATION_ACTIVE');
  }

  // Invariants
  const invariants = determineInvariants(mode, ctx.isRemoteAccess);

  // Build cache key
  const cacheKey = deriveCacheKey({
    mediaId: ctx.mediaId,
    fingerprint: ctx.media.fingerprint,
    mode,
    container,
    video: videoPlan,
    audio: audioPlan,
    subtitles: subtitlePlan,
    hdr: hdrPlan,
    quirks: quirksPlan,
    modifications,
  });

  const plan: PlaybackPlan = {
    planId: randomUUID(),
    sessionId: ctx.sessionId,
    mediaId: ctx.mediaId,
    userId: ctx.userId,
    transport,
    mode,
    container,
    video: videoPlan,
    audio: audioPlan,
    subtitles: subtitlePlan,
    hdr: hdrPlan,
    quirks: quirksPlan,
    modifications,
    segmentConfig,
    reasonCodes: [...new Set(reasonCodes)], // Dedupe
    decisionPath,
    invariants,
    cacheKey,
    createdAt: new Date().toISOString(),
  };

  const planningMs = Date.now() - startTime;
  logger.info(
    {
      sessionId: ctx.sessionId,
      mode: plan.mode,
      transport: plan.transport,
      videoAction: plan.video.action,
      audioAction: plan.audio.action,
      planningMs,
    },
    'Playback plan created'
  );

  return plan;
}

// =============================================================================
// Track Selection
// =============================================================================

function selectVideoStream(media: MediaProbeResult): VideoStreamInfo | undefined {
  // Prefer default, then first
  return (
    media.videoStreams.find((s) => s.isDefault) ?? media.videoStreams[0]
  );
}

function selectAudioStream(
  media: MediaProbeResult,
  prefs: UserPlaybackPreferences
): AudioStreamInfo | undefined {
  const streams = media.audioStreams;
  if (streams.length === 0) return undefined;

  // Filter out commentary tracks unless specifically requested
  const nonCommentary = streams.filter((s) => !s.isCommentary);
  const pool = nonCommentary.length > 0 ? nonCommentary : streams;

  // Prefer matching language
  if (prefs.preferredAudioLanguage) {
    const langMatch = pool.find(
      (s) => s.language?.toLowerCase() === prefs.preferredAudioLanguage?.toLowerCase()
    );
    if (langMatch) return langMatch;
  }

  // Prefer default
  const defaultStream = pool.find((s) => s.isDefault);
  if (defaultStream) return defaultStream;

  // First stream
  return pool[0];
}

function selectSubtitleStream(
  media: MediaProbeResult,
  prefs: UserPlaybackPreferences
): SubtitleStreamInfo | undefined {
  if (!prefs.forceSubtitles && !prefs.preferredSubtitleLanguage) {
    return undefined;
  }

  const streams = media.subtitleStreams;

  // Prefer matching language
  if (prefs.preferredSubtitleLanguage) {
    const langMatch = streams.find(
      (s) =>
        s.language?.toLowerCase() === prefs.preferredSubtitleLanguage?.toLowerCase()
    );
    if (langMatch) return langMatch;
  }

  // Prefer forced subtitles
  const forced = streams.find((s) => s.isForced);
  if (forced) return forced;

  // Prefer default
  const defaultStream = streams.find((s) => s.isDefault);
  if (defaultStream) return defaultStream;

  return streams[0];
}

// =============================================================================
// Compatibility Analysis
// =============================================================================

interface CompatibilityResult {
  needsTranscode: boolean;
  needsRemux: boolean;
  reasons: PlaybackReasonCode[];
  decisions: string[];
}

function analyzeVideoCompatibility(
  video: VideoStreamInfo,
  client: ClientCapabilities,
  server: ServerCapabilities,
  prefs: UserPlaybackPreferences
): CompatibilityResult {
  const reasons: PlaybackReasonCode[] = [];
  const decisions: string[] = [];
  let needsTranscode = false;
  let needsRemux = false;

  // Check codec support
  const codecSupported = clientSupportsVideoCodec(
    client,
    video.codec,
    video.level,
    { width: video.width, height: video.height }
  );

  if (!codecSupported) {
    needsTranscode = true;
    reasons.push('CODEC_UNSUPPORTED');
    decisions.push(`Video codec ${video.codec} not supported by client`);
  } else {
    decisions.push(`Video codec ${video.codec} supported`);
  }

  // Check resolution constraints
  const maxRes = getMaxResolutionDimensions(
    prefs.maxResolution ?? client.maxResolution
  );
  if (video.height > maxRes.height || video.width > maxRes.width) {
    needsTranscode = true;
    reasons.push('RESOLUTION_DOWNSCALE');
    decisions.push(
      `Resolution ${video.width}x${video.height} exceeds max ${maxRes.width}x${maxRes.height}`
    );
  }

  // Check HDR compatibility
  if (video.isHDR && video.hdrFormat) {
    const hdrSupported = clientSupportsHDR(client, video.hdrFormat);
    if (!hdrSupported) {
      // HDR needs handling (tonemap or convert)
      if (video.hdrFormat.startsWith('dv_')) {
        // Dolby Vision - check if we can handle it
        const dvManifest = server.ffmpegManifest.dolbyVision;
        if (video.hdrFormat === 'dv_p8' && dvManifest.canExtractHDR10Base) {
          // Can extract HDR10 base layer
          reasons.push('HDR_EXTRACT_BASE_LAYER');
          decisions.push('DV P8 - will extract HDR10 base layer');
        } else if (dvManifest.canConvertToHDR10) {
          reasons.push('HDR_CONVERT_TO_HDR10');
          decisions.push('DV - will convert to HDR10');
        } else if (dvManifest.canTonemap) {
          needsTranscode = true;
          reasons.push('HDR_TONEMAP_REQUIRED');
          decisions.push('DV - will tonemap to SDR');
        } else {
          needsTranscode = true;
          reasons.push('DV_TOOLCHAIN_UNSUPPORTED');
          decisions.push('DV - toolchain unsupported, forcing transcode');
        }
      } else {
        // HDR10/HLG - can tonemap if needed
        needsTranscode = true;
        reasons.push('HDR_TONEMAP_REQUIRED');
        decisions.push(`${video.hdrFormat} - client doesn't support, will tonemap`);
      }
    } else {
      reasons.push('HDR_PASSTHROUGH');
      decisions.push(`${video.hdrFormat} - client supports HDR, passthrough`);
    }
  }

  // Check bitrate constraints
  if (prefs.maxBitrate && video.bitrate && video.bitrate > prefs.maxBitrate) {
    needsTranscode = true;
    reasons.push('BITRATE_CONSTRAINED');
    decisions.push(
      `Bitrate ${video.bitrate} exceeds max ${prefs.maxBitrate}`
    );
  }

  return { needsTranscode, needsRemux, reasons, decisions };
}

function analyzeAudioCompatibility(
  audio: AudioStreamInfo,
  client: ClientCapabilities
): CompatibilityResult {
  const reasons: PlaybackReasonCode[] = [];
  const decisions: string[] = [];
  let needsTranscode = false;

  // Check codec support
  const codecSupported = clientSupportsAudioCodec(
    client,
    audio.codec,
    audio.channels
  );

  if (!codecSupported) {
    needsTranscode = true;
    reasons.push('CODEC_UNSUPPORTED');
    decisions.push(`Audio codec ${audio.codec} not supported by client`);
  } else {
    decisions.push(`Audio codec ${audio.codec} supported`);
  }

  // Check channel count
  if (audio.channels > client.maxAudioChannels) {
    needsTranscode = true;
    decisions.push(
      `Audio channels ${audio.channels} exceeds client max ${client.maxAudioChannels}`
    );
  }

  return { needsTranscode, needsRemux: false, reasons, decisions };
}

// =============================================================================
// Transport & Mode Determination
// =============================================================================

function determineTransport(
  ctx: PlaybackPlanContext,
  videoCompat: CompatibilityResult
): PlaybackTransport {
  // If video needs transcode, always use HLS
  if (videoCompat.needsTranscode) {
    return 'hls';
  }

  // Check client range reliability
  if (ctx.client.rangeReliability === 'untrusted') {
    return 'hls';
  }

  // Remote access prefers HLS for better buffering
  if (ctx.isRemoteAccess && ctx.client.rangeReliability !== 'trusted') {
    return 'hls';
  }

  // Check if container is compatible for range serving
  const format = ctx.media.format.name.toLowerCase();
  if (!format.includes('mp4') && !format.includes('mov') && !format.includes('matroska')) {
    // Non-standard container, prefer HLS
    return 'hls';
  }

  return 'range';
}

function determinePlaybackMode(
  videoCompat: CompatibilityResult,
  audioCompat: CompatibilityResult,
  transport: PlaybackTransport,
  ctx: PlaybackPlanContext
): PlaybackMode {
  const videoNeedsTranscode = videoCompat.needsTranscode;
  const audioNeedsTranscode = audioCompat.needsTranscode;

  // Full transcode required
  if (videoNeedsTranscode) {
    return 'transcode_hls';
  }

  // Video is compatible - check audio
  if (transport === 'range') {
    // Direct play modes
    if (!audioNeedsTranscode) {
      return 'direct';
    }
    return 'direct_audio_transcode';
  }

  // HLS transport
  // Check if keyframes are suitable for remux-to-HLS
  const keyframes = ctx.media.keyframeAnalysis;
  const keyframesOK =
    !keyframes ||
    (keyframes.isRegular && keyframes.maxInterval <= MAX_KEYFRAME_INTERVAL_FOR_REMUX_HLS);

  if (!keyframesOK) {
    // Sparse keyframes - must transcode
    videoCompat.reasons.push('KEYFRAMES_SPARSE');
    return 'transcode_hls';
  }

  // Remux-to-HLS modes
  if (!audioNeedsTranscode) {
    return 'remux_hls';
  }
  return 'remux_hls_audio_transcode';
}

// =============================================================================
// Plan Building
// =============================================================================

function buildVideoPlan(
  video: VideoStreamInfo,
  _compat: CompatibilityResult,
  mode: PlaybackMode,
  ctx: PlaybackPlanContext
): VideoTrackPlan {
  const filters: string[] = [];
  let action: TrackAction = 'copy';
  let codec: VideoCodec = 'source';
  let encoder: string | undefined;
  let hwaccel = false;

  if (mode === 'transcode_hls') {
    action = 'encode';

    // Determine target codec
    // Prefer H.264 for maximum compatibility
    codec = 'h264';
    encoder = getBestH264Encoder(ctx.server.ffmpegManifest) ?? undefined;
    hwaccel = encoder !== 'libx264' && encoder !== undefined;

    // Add deinterlace filter if needed
    if (ctx.media.contentQuirks.isInterlaced) {
      const deinterlace = getDeinterlaceFilter(
        ctx.server.ffmpegManifest,
        ctx.media.contentQuirks.interlaceType
      );
      if (deinterlace) {
        filters.push(deinterlace);
      }
    }

    // Add VFR→CFR filter if needed
    if (ctx.media.contentQuirks.isVariableFrameRate) {
      // Target 30fps CFR
      filters.push('fps=30');
    }
  }

  // Determine resolution
  let resolution: { width: number; height: number } | undefined;
  const maxRes = getMaxResolutionDimensions(
    ctx.preferences.maxResolution ?? ctx.client.maxResolution
  );

  if (video.height > maxRes.height || video.width > maxRes.width) {
    // Scale down maintaining aspect ratio
    const scale = Math.min(maxRes.width / video.width, maxRes.height / video.height);
    resolution = {
      width: Math.round(video.width * scale / 2) * 2, // Ensure even
      height: Math.round(video.height * scale / 2) * 2,
    };

    if (action === 'encode') {
      filters.push(`scale=${resolution.width}:${resolution.height}`);
    }
  }

  return {
    action,
    sourceIndex: video.index,
    codec,
    encoder,
    hwaccel,
    profile: action === 'encode' ? 'high' : undefined,
    resolution,
    filters,
  };
}

function buildAudioPlan(
  audio: AudioStreamInfo,
  _compat: CompatibilityResult,
  mode: PlaybackMode,
  ctx: PlaybackPlanContext
): AudioTrackPlan {
  const filters: string[] = [];
  let action: TrackAction = 'copy';
  let codec: AudioCodec = 'source';

  const modeNeedsAudioTranscode =
    mode === 'direct_audio_transcode' ||
    mode === 'remux_audio_transcode' ||
    mode === 'remux_hls_audio_transcode' ||
    mode === 'transcode_hls';

  if (modeNeedsAudioTranscode) {
    action = 'encode';
    codec = 'aac'; // AAC for maximum compatibility
  }

  // Determine channel count
  let channels = audio.channels;
  if (channels > ctx.client.maxAudioChannels) {
    channels = ctx.client.maxAudioChannels;
    action = 'encode';
    codec = 'aac';
  }

  // Audio normalization
  if (
    ctx.preferences.audioNormalization === 'standard' &&
    hasFilter(ctx.server.ffmpegManifest, 'loudnorm')
  ) {
    filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
    action = 'encode';
    codec = 'aac';
  } else if (
    ctx.preferences.audioNormalization === 'night' &&
    hasFilter(ctx.server.ffmpegManifest, 'loudnorm')
  ) {
    filters.push('loudnorm=I=-24:TP=-2:LRA=7');
    filters.push('acompressor=threshold=-20dB:ratio=4:attack=5:release=50');
    action = 'encode';
    codec = 'aac';
  }

  // Playback speed
  if (ctx.playbackSpeed && ctx.playbackSpeed !== 1.0) {
    if (hasFilter(ctx.server.ffmpegManifest, 'atempo')) {
      filters.push(`atempo=${ctx.playbackSpeed}`);
      action = 'encode';
      codec = 'aac';
    }
  }

  return {
    action,
    sourceIndex: audio.index,
    codec,
    channels,
    bitrate: action === 'encode' ? (channels > 2 ? 384000 : 256000) : undefined,
    filters,
  };
}

function buildSilentAudioPlan(): AudioTrackPlan {
  return {
    action: 'copy',
    sourceIndex: -1,
    codec: 'source',
    channels: 0,
    filters: [],
  };
}

function buildSubtitlePlan(
  subtitle: SubtitleStreamInfo | undefined,
  prefs: UserPlaybackPreferences,
  _mode: PlaybackMode
): SubtitlePlan {
  if (!subtitle) {
    return { mode: 'none' };
  }

  // Burn-in if requested or if subtitle is bitmap-based
  if (prefs.burnInSubtitles || !subtitle.isText) {
    return {
      mode: 'burn',
      sourceIndex: subtitle.index,
    };
  }

  // Sidecar for text-based subtitles
  return {
    mode: 'sidecar',
    sourceIndex: subtitle.index,
    format: 'webvtt',
  };
}

function buildHDRPlan(
  video: VideoStreamInfo,
  _compat: CompatibilityResult,
  client: ClientCapabilities,
  server: ServerCapabilities
): HDRPlan {
  const sourceFormat: HDRFormat = video.hdrFormat ?? 'sdr';

  if (sourceFormat === 'sdr') {
    return { sourceFormat, mode: 'passthrough' };
  }

  // Check if client supports this HDR format
  const hdrSupported = clientSupportsHDR(client, sourceFormat);

  if (hdrSupported) {
    return { sourceFormat, mode: 'passthrough' };
  }

  // Need to convert/tonemap
  const dvManifest = server.ffmpegManifest.dolbyVision;

  if (sourceFormat.startsWith('dv_')) {
    // Dolby Vision handling
    if (sourceFormat === 'dv_p8' && dvManifest.canExtractHDR10Base) {
      return { sourceFormat, mode: 'extract_hdr10_base' };
    }
    if (dvManifest.canConvertToHDR10 && client.hdr.hdr10) {
      return { sourceFormat, mode: 'convert_hdr10' };
    }
    // Fall through to tonemap
  }

  // Tonemap to SDR
  const tonemapFilter = getToneMapFilter(server.ffmpegManifest);
  return {
    sourceFormat,
    mode: 'tonemap_sdr',
    tonemapFilter: tonemapFilter ?? undefined,
  };
}

function buildQuirksPlan(
  quirks: MediaProbeResult['contentQuirks'],
  server: ServerCapabilities
): ContentQuirksPlan {
  const plan: ContentQuirksPlan = {};

  if (quirks.isInterlaced) {
    const filter = getDeinterlaceFilter(
      server.ffmpegManifest,
      quirks.interlaceType
    );
    if (filter) {
      plan.deinterlace = {
        filter,
        reason: `Interlaced content (${quirks.interlaceType ?? 'unknown'} field order)`,
      };
    }
  }

  if (quirks.isVariableFrameRate && quirks.vfrRange) {
    plan.vfrToCfr = {
      targetFps: Math.round(quirks.vfrRange.avg),
      reason: `VFR content (${quirks.vfrRange.min.toFixed(1)}-${quirks.vfrRange.max.toFixed(1)} fps)`,
    };
  }

  if (quirks.isTelecined) {
    plan.telecineRemoval = true;
  }

  if (quirks.hasAudioSyncIssue && quirks.audioSyncOffsetMs) {
    plan.audioSync = { delayMs: quirks.audioSyncOffsetMs };
  }

  if (quirks.isLegacyContainer && quirks.containerName) {
    plan.containerFix = {
      from: quirks.containerName,
      to: 'mp4',
    };
  }

  return plan;
}

function getHDRReasonCode(mode: HDRMode): PlaybackReasonCode {
  switch (mode) {
    case 'convert_hdr10':
      return 'HDR_CONVERT_TO_HDR10';
    case 'extract_hdr10_base':
      return 'HDR_EXTRACT_BASE_LAYER';
    case 'tonemap_sdr':
      return 'HDR_TONEMAP_REQUIRED';
    default:
      return 'HDR_PASSTHROUGH';
  }
}

// =============================================================================
// Container & Segments
// =============================================================================

function determineContainer(
  _mode: PlaybackMode,
  transport: PlaybackTransport
): ContainerFormat {
  if (transport === 'range') {
    return 'source';
  }

  // HLS transport
  // Use fMP4 for modern clients, TS for maximum compatibility
  // For now, default to TS for safety
  return 'hls_ts';
}

function determineSegmentConfig(ctx: PlaybackPlanContext): SegmentConfig {
  // Interactive playback: shorter segments for faster seeking
  if (!ctx.isRemoteAccess) {
    return { durationSeconds: 4, lookaheadSeconds: 12 };
  }

  // Remote: longer segments for better buffering
  return { durationSeconds: 6, lookaheadSeconds: 18 };
}

function determineInvariants(
  mode: PlaybackMode,
  isRemote?: boolean
): PlaybackInvariant[] {
  const invariants: PlaybackInvariant[] = [
    'NO_UPSCALE',
    'NO_AUDIO_UPMIX',
    'MONOTONIC_PTS',
    'AUDIO_VIDEO_SYNC_WITHIN_50MS',
  ];

  // Startup time requirements
  if (isRemote) {
    invariants.push('MUST_START_UNDER_10S');
  } else {
    invariants.push('MUST_START_UNDER_5S');
  }

  // HLS modes need consistent segments
  if (mode.includes('hls')) {
    invariants.push('SEGMENT_DURATION_CONSISTENT');
  }

  return invariants;
}

// =============================================================================
// Cache Key Derivation
// =============================================================================

interface CacheKeyInput {
  mediaId: string;
  fingerprint: string;
  mode: PlaybackMode;
  container: ContainerFormat;
  video: VideoTrackPlan;
  audio: AudioTrackPlan;
  subtitles: SubtitlePlan;
  hdr: HDRPlan;
  quirks: ContentQuirksPlan;
  modifications: PlaybackModifications;
}

/**
 * Derive a cache key from the PlaybackPlan.
 *
 * The cache key must include all parameters that affect the output.
 * If any parameter changes, the cache key must change.
 */
export function deriveCacheKey(input: CacheKeyInput): string {
  const parts = [
    // Schema version (increment when cache format changes)
    'v1',
    // Media identity
    input.mediaId,
    input.fingerprint,
    // Mode & container
    input.mode,
    input.container,
    // Video
    input.video.action,
    input.video.codec,
    input.video.encoder ?? 'none',
    input.video.resolution
      ? `${input.video.resolution.width}x${input.video.resolution.height}`
      : 'native',
    input.video.filters.length > 0 ? input.video.filters.join(',') : 'nofilters',
    // Audio
    input.audio.action,
    input.audio.codec,
    input.audio.channels.toString(),
    input.audio.filters.length > 0 ? input.audio.filters.join(',') : 'nofilters',
    // Subtitles
    input.subtitles.mode,
    input.subtitles.sourceIndex?.toString() ?? 'none',
    // HDR
    input.hdr.mode,
    // Quirks
    input.quirks.deinterlace ? 'deint' : '',
    input.quirks.vfrToCfr ? `cfr${input.quirks.vfrToCfr.targetFps}` : '',
    // Modifications
    input.modifications.speed !== 1.0 ? `speed${input.modifications.speed}` : '',
    input.modifications.audioNormalization !== 'off'
      ? `norm${input.modifications.audioNormalization}`
      : '',
  ];

  // Filter out empty strings and join
  return parts.filter(Boolean).join('_');
}

/**
 * Get a human-readable summary of the playback plan.
 */
export function getPlaybackPlanSummary(plan: PlaybackPlan): string {
  const lines = [
    `Mode: ${plan.mode}`,
    `Transport: ${plan.transport}`,
    `Container: ${plan.container}`,
    `Video: ${plan.video.action} (${plan.video.codec}${plan.video.encoder ? ' via ' + plan.video.encoder : ''})`,
    `Audio: ${plan.audio.action} (${plan.audio.codec}, ${plan.audio.channels}ch)`,
    `Subtitles: ${plan.subtitles.mode}`,
    `HDR: ${plan.hdr.sourceFormat} → ${plan.hdr.mode}`,
  ];

  if (plan.reasonCodes.length > 0) {
    lines.push(`Reasons: ${plan.reasonCodes.join(', ')}`);
  }

  return lines.join('\n');
}
