/**
 * Transcoding pipeline types.
 *
 * These types define the core data structures for the transcoding pipeline,
 * including capability detection, playback planning, and decision auditing.
 *
 * @see docs/TRANSCODING_PIPELINE.md for full specification
 */

import type { ISODateString, UUID } from './common.js';

// =============================================================================
// Server Capability Detection
// =============================================================================

/** CPU vendor detection */
export type CPUVendor = 'intel' | 'amd' | 'arm' | 'apple' | 'unknown';

/** GPU vendor detection */
export type GPUVendor = 'nvidia' | 'intel' | 'amd' | 'apple' | 'none';

/** CPU architecture */
export type CPUArchitecture = 'x64' | 'arm64';

/** Server classification based on hardware capabilities */
export type ServerClass = 'low' | 'medium' | 'high' | 'enterprise';

/** CPU information */
export interface CPUInfo {
  model: string;
  vendor: CPUVendor;
  cores: number;
  threads: number;
  architecture: CPUArchitecture;
  benchmarkScore: number;
}

/** GPU information */
export interface GPUInfo {
  vendor: GPUVendor;
  model: string;
  vram: number; // MB
  driverVersion: string;
}

/** Hardware acceleration support */
export interface HWAccelSupport {
  cuda: boolean;
  nvdec: boolean;
  qsv: boolean;
  vaapi: boolean;
  videotoolbox: boolean;
  d3d11va: boolean;
}

/** FFmpeg encoder support */
export interface EncoderSupport {
  // Software encoders
  libx264: boolean;
  libx265: boolean;
  libsvtav1: boolean;
  libvpx_vp9: boolean;
  aac: boolean;
  libopus: boolean;

  // NVIDIA
  h264_nvenc: boolean;
  hevc_nvenc: boolean;
  av1_nvenc: boolean;

  // Intel QSV
  h264_qsv: boolean;
  hevc_qsv: boolean;
  av1_qsv: boolean;

  // AMD AMF
  h264_amf: boolean;
  hevc_amf: boolean;

  // Apple VideoToolbox
  h264_videotoolbox: boolean;
  hevc_videotoolbox: boolean;
}

/** FFmpeg decoder support (hardware) */
export interface DecoderSupport {
  h264_cuvid: boolean;
  hevc_cuvid: boolean;
  av1_cuvid: boolean;
  h264_qsv: boolean;
  hevc_qsv: boolean;
}

/** FFmpeg filter support */
export interface FilterSupport {
  // Tone mapping
  tonemap: boolean;
  tonemap_cuda: boolean;
  tonemap_opencl: boolean;
  zscale: boolean;

  // Deinterlacing
  yadif: boolean;
  yadif_cuda: boolean;
  bwdif: boolean;
  bwdif_cuda: boolean;

  // Scaling
  scale: boolean;
  scale_cuda: boolean;
  scale_qsv: boolean;

  // Subtitles
  subtitles: boolean;

  // Audio
  loudnorm: boolean;
  atempo: boolean;
}

/** Dolby Vision handling capabilities */
export interface DolbyVisionSupport {
  canDetect: boolean;
  canExtractHDR10Base: boolean;
  canConvertToHDR10: boolean;
  canTonemap: boolean;
}

/**
 * FFmpeg Capability Manifest
 *
 * Generated at startup by actually testing each encoder, decoder, and filter.
 * Never assume capabilities exist—test them.
 */
export interface FFmpegCapabilityManifest {
  ffmpegVersion: string;
  ffprobeVersion: string;

  hwaccel: HWAccelSupport;
  encoders: EncoderSupport;
  decoders: DecoderSupport;
  filters: FilterSupport;
  dolbyVision: DolbyVisionSupport;

  generatedAt: ISODateString;
  generationDurationMs: number;
}

/**
 * Server Capabilities
 *
 * Complete picture of what this server can do.
 */
export interface ServerCapabilities {
  cpu: CPUInfo;
  gpu: GPUInfo;
  ffmpegManifest: FFmpegCapabilityManifest;
  serverClass: ServerClass;
  maxConcurrentTranscodes: number;
  maxConcurrentThumbnailJobs: number;
  ramMB: number;
  scratchDiskSpaceGB: number;
  detectedAt: ISODateString;
}

// =============================================================================
// Client Capability Detection
// =============================================================================

/** Video codec support with details */
export interface VideoCodecSupport {
  supported: boolean;
  maxLevel?: string;
  maxResolution?: string;
}

/** Client video codec capabilities */
export interface ClientVideoCodecs {
  h264: VideoCodecSupport;
  hevc: VideoCodecSupport;
  vp9: { supported: boolean; profile?: number };
  av1: { supported: boolean };
}

/** Client audio codec capabilities */
export interface ClientAudioCodecs {
  aac: boolean;
  ac3: boolean;
  eac3: boolean;
  dts: boolean;
  opus: boolean;
  flac: boolean;
  truehd: boolean;
}

/** Client HDR capabilities */
export interface ClientHDRSupport {
  hdr10: boolean;
  dolbyVision: boolean;
  dvProfile5: boolean;
  dvProfile7: boolean;
  dvProfile8: boolean;
  hlg: boolean;
}

/** Maximum resolution the client supports */
export type MaxResolution = '4k' | '1080p' | '720p' | '480p';

/** How reliable range requests are for this client */
export type RangeReliability = 'trusted' | 'suspect' | 'untrusted';

/** Trickplay format the client supports */
export type TrickplayFormat = 'bif' | 'webvtt' | 'none';

/**
 * Client Capabilities
 *
 * What the client device can play natively.
 */
export interface ClientCapabilities {
  videoCodecs: ClientVideoCodecs;
  audioCodecs: ClientAudioCodecs;
  maxAudioChannels: number;
  hdr: ClientHDRSupport;
  maxResolution: MaxResolution;
  confidenceScore: number;
  rangeReliability: RangeReliability;
  supportsPlaybackSpeed: boolean;
  supportsTrickplay: TrickplayFormat;
}

// =============================================================================
// Playback Plan
// =============================================================================

/** Transport protocol for streaming */
export type PlaybackTransport = 'range' | 'hls';

/** Playback mode - which tier of the hierarchy we're using */
export type PlaybackMode =
  | 'direct'
  | 'direct_audio_transcode'
  | 'remux'
  | 'remux_audio_transcode'
  | 'remux_hls'
  | 'remux_hls_audio_transcode'
  | 'transcode_hls';

/** Output container format */
export type ContainerFormat = 'source' | 'mp4' | 'mkv' | 'hls_ts' | 'hls_fmp4';

/** Video/audio action */
export type TrackAction = 'copy' | 'encode';

/** Video codec output */
export type VideoCodec = 'source' | 'h264' | 'hevc' | 'av1' | 'vp9';

/** Audio codec output */
export type AudioCodec = 'source' | 'aac' | 'ac3' | 'eac3' | 'opus';

/** HDR source format */
export type HDRFormat =
  | 'sdr'
  | 'hdr10'
  | 'hdr10plus'
  | 'hlg'
  | 'dv_p5'
  | 'dv_p7'
  | 'dv_p8';

/** HDR handling mode */
export type HDRMode =
  | 'passthrough'
  | 'convert_hdr10'
  | 'extract_hdr10_base'
  | 'tonemap_sdr';

/** Subtitle rendering mode */
export type SubtitleMode = 'none' | 'sidecar' | 'burn';

/** Audio normalization mode */
export type AudioNormalization = 'off' | 'standard' | 'night';

/** Video track decision */
export interface VideoTrackPlan {
  action: TrackAction;
  sourceIndex: number;
  codec: VideoCodec;
  encoder?: string; // e.g., 'h264_nvenc', 'libx264'
  hwaccel: boolean;
  profile?: string; // e.g., 'high', 'main10'
  level?: string;
  bitrate?: number;
  crf?: number;
  resolution?: { width: number; height: number };
  filters: string[]; // Ordered list of filters to apply
}

/** Audio track decision */
export interface AudioTrackPlan {
  action: TrackAction;
  sourceIndex: number;
  codec: AudioCodec;
  channels: number;
  bitrate?: number;
  filters: string[]; // e.g., ['loudnorm=I=-16']
}

/** Audio track in an HLS audio group */
export interface AudioGroupTrack {
  index: number;
  language: string;
  label: string;
  codec: string;
  channels: number;
  isDefault: boolean;
}

/** HLS audio group layout */
export interface AudioGroupLayout {
  groupId: string;
  tracks: AudioGroupTrack[];
}

/** Subtitle handling decision */
export interface SubtitlePlan {
  mode: SubtitleMode;
  sourceIndex?: number;
  format?: 'webvtt' | 'source';
}

/** HDR handling decision */
export interface HDRPlan {
  sourceFormat: HDRFormat;
  mode: HDRMode;
  tonemapFilter?: string;
}

/** Content quirks that require special handling */
export interface ContentQuirksPlan {
  deinterlace?: { filter: string; reason: string };
  vfrToCfr?: { targetFps: number; reason: string };
  telecineRemoval?: boolean;
  audioSync?: { delayMs: number };
  containerFix?: { from: string; to: string };
}

/** Playback modifications (speed, normalization) */
export interface PlaybackModifications {
  speed: number; // 1.0 = normal
  audioNormalization: AudioNormalization;
}

/** Segment configuration for HLS */
export interface SegmentConfig {
  durationSeconds: number;
  lookaheadSeconds: number;
}

/**
 * Reason codes explaining why a particular decision was made.
 * Used for debugging and observability.
 */
export type PlaybackReasonCode =
  | 'CLIENT_SUPPORTS_SOURCE'
  | 'CLIENT_SUPPORTS_VIDEO_NOT_AUDIO'
  | 'CONTAINER_INCOMPATIBLE'
  | 'RANGE_UNRELIABLE'
  | 'KEYFRAMES_SPARSE'
  | 'CODEC_UNSUPPORTED'
  | 'HDR_PASSTHROUGH'
  | 'HDR_CONVERT_TO_HDR10'
  | 'HDR_EXTRACT_BASE_LAYER'
  | 'HDR_TONEMAP_REQUIRED'
  | 'DV_PROFILE_INCOMPATIBLE'
  | 'DV_TOOLCHAIN_UNSUPPORTED'
  | 'RESOLUTION_DOWNSCALE'
  | 'BITRATE_CONSTRAINED'
  | 'BURN_IN_SUBTITLES'
  | 'DEINTERLACE_REQUIRED'
  | 'VFR_CONVERSION_REQUIRED'
  | 'TELECINE_REMOVAL'
  | 'AUDIO_SYNC_CORRECTION'
  | 'LEGACY_CONTAINER_FIX'
  | 'SPEED_CHANGE_ACTIVE'
  | 'AUDIO_NORMALIZATION_ACTIVE'
  | 'FORCED_FALLBACK'
  | 'POISON_MEDIA_FALLBACK'
  | 'CAPABILITY_NOT_AVAILABLE';

/**
 * Invariants that must hold for the playback to be correct.
 */
export type PlaybackInvariant =
  | 'MUST_START_UNDER_5S'
  | 'MUST_START_UNDER_10S'
  | 'NO_UPSCALE'
  | 'NO_AUDIO_UPMIX'
  | 'MONOTONIC_PTS'
  | 'SEGMENT_DURATION_CONSISTENT'
  | 'AUDIO_VIDEO_SYNC_WITHIN_50MS';

/**
 * PlaybackPlan - Single Source of Truth
 *
 * The canonical output of all playback decision-making. Computed once and
 * drives everything: FFmpeg command building, URL generation, cache keys,
 * and logging.
 *
 * This prevents subtle divergence like: profile selector picks HEVC but
 * HLS container policy forces TS which breaks certain clients.
 */
export interface PlaybackPlan {
  // === Identity ===
  planId: UUID;
  sessionId: UUID;
  mediaId: UUID;
  userId: UUID;

  // === Transport ===
  transport: PlaybackTransport;

  // === Playback Mode ===
  mode: PlaybackMode;

  // === Container ===
  container: ContainerFormat;

  // === Video Track ===
  video: VideoTrackPlan;

  // === Audio Track ===
  audio: AudioTrackPlan;

  // === Audio Group Layout (for HLS with multiple audio tracks) ===
  audioGroups?: AudioGroupLayout;

  // === Subtitles ===
  subtitles: SubtitlePlan;

  // === HDR Handling ===
  hdr: HDRPlan;

  // === Content Quirks Applied ===
  quirks: ContentQuirksPlan;

  // === Playback Modifications ===
  modifications: PlaybackModifications;

  // === Segment Configuration ===
  segmentConfig: SegmentConfig;

  // === Decision Audit ===
  reasonCodes: PlaybackReasonCode[];
  decisionPath: string[]; // Ordered steps taken to reach this plan

  // === Invariants ===
  invariants: PlaybackInvariant[];

  // === Cache Key ===
  cacheKey: string; // Derived from plan contents

  // === Timestamps ===
  createdAt: ISODateString;
  expiresAt?: ISODateString;
}

// =============================================================================
// Media Analysis
// =============================================================================

/** Keyframe analysis result */
export interface KeyframeAnalysis {
  maxInterval: number; // seconds
  avgInterval: number; // seconds
  isRegular: boolean; // variance < 20%
  confidence: 'high' | 'sampled' | 'estimated';
  sampleRegions: string[]; // e.g., ['start', 'middle', 'end']
}

/** Content quirks detected in media */
export interface ContentQuirks {
  isInterlaced: boolean;
  interlaceType?: 'tff' | 'bff';
  isVariableFrameRate: boolean;
  vfrRange?: { min: number; max: number; avg: number };
  isTelecined: boolean;
  hasAudioSyncIssue: boolean;
  audioSyncOffsetMs?: number;
  isLegacyContainer: boolean;
  containerName?: string;
}

/** Video stream information from probe */
export interface VideoStreamInfo {
  index: number;
  codec: string;
  profile?: string;
  level?: number;
  width: number;
  height: number;
  bitrate?: number;
  frameRate: number;
  isHDR: boolean;
  hdrFormat?: HDRFormat;
  colorSpace?: string;
  colorTransfer?: string;
  colorPrimaries?: string;
  isDefault: boolean;
}

/** Audio stream information from probe */
export interface AudioStreamInfo {
  index: number;
  codec: string;
  channels: number;
  channelLayout?: string;
  sampleRate: number;
  bitrate?: number;
  language?: string;
  title?: string;
  isDefault: boolean;
  isCommentary: boolean;
}

/** Subtitle stream information from probe */
export interface SubtitleStreamInfo {
  index: number;
  codec: string;
  language?: string;
  title?: string;
  isForced: boolean;
  isDefault: boolean;
  isSDH: boolean;
  isText: boolean; // true for SRT/ASS/WebVTT, false for PGS/VOBSUB
}

/** Chapter information from probe */
export interface ChapterInfo {
  index: number;
  startTime: number;
  endTime: number;
  title?: string;
}

/** Format information from probe */
export interface FormatInfo {
  name: string;
  duration: number;
  bitrate: number;
  startTime: number;
}

/**
 * Complete media probe result
 */
export interface MediaProbeResult {
  filePath: string;
  fileSize: number;
  mtime: number;
  fingerprint: string; // `${fileSize}_${mtime}`

  format: FormatInfo;

  videoStreams: VideoStreamInfo[];
  audioStreams: AudioStreamInfo[];
  subtitleStreams: SubtitleStreamInfo[];
  chapters: ChapterInfo[];

  keyframeAnalysis?: KeyframeAnalysis;
  contentQuirks: ContentQuirks;

  scannedAt: ISODateString;
  scanDurationMs: number;
  scanAttempts: number;
  ffprobeVersion: string;
}

// =============================================================================
// Session & Cache Management
// =============================================================================

/** HLS epoch state */
export interface EpochState {
  epochIndex: number;
  mediaSequenceBase: 0; // Always 0 per epoch
  discontinuitySequence: number; // Increments with each epoch
  segmentIndex: number; // Resets to 0 per epoch
}

/** Transcode session state */
export interface TranscodeSessionState {
  sessionId: UUID;
  userId: UUID;
  mediaId: UUID;
  playbackPlan: PlaybackPlan;
  currentEpoch: EpochState;
  currentPositionSeconds: number;
  status: 'active' | 'paused' | 'ended' | 'error';
  startedAt: ISODateString;
  lastActivityAt: ISODateString;
  endedAt?: ISODateString;
}

/** Cache entry metadata */
export interface TranscodeCacheEntry {
  id: UUID;
  mediaId: UUID;
  cacheKey: string;
  playbackPlan: PlaybackPlan;
  sizeBytes: number;
  segmentCount: number;
  status: 'complete' | 'partial' | 'error';
  createdAt: ISODateString;
  lastAccessedAt: ISODateString;
  lastVerifiedAt?: ISODateString;
}

/** Media health tracking for poison media detection */
export interface MediaHealth {
  mediaId: UUID;
  failureCount: number;
  lastFailureAt?: ISODateString;
  failureReasons: string[];
  status: 'healthy' | 'suspect' | 'poison';
}

// =============================================================================
// Configuration & Policies
// =============================================================================

/** Timeout policy for transcoding */
export interface TimeoutPolicy {
  firstSegmentDeadlineMs: number;
  firstSegmentInteractiveMs: number;
  noProgressTimeoutMs: number;
  seekSegmentTimeoutMs: number;
  totalSessionTimeoutMs: number;
}

/** Restart policy for failed transcodes */
export interface RestartPolicy {
  maxRestartsPerSession: number;
  backoffMs: number[];
  resetAfterSuccessMs: number;
}

/** Poison media policy */
export interface PoisonPolicy {
  failureThreshold: number;
  poisonThreshold: number;
  decayPeriodDays: number;
}

/** Admission control policy */
export interface AdmissionPolicy {
  maxConcurrent: number;
  maxQueueDepth: number;
  priorityLevels: {
    interactive: number;
    prefetch: number;
    trickplay: number;
    background: number;
  };
}

/** Queue timeout policy */
export interface QueuePolicy {
  interactiveTimeoutMs: number;
  prefetchTimeoutMs: number;
  trickplayTimeoutMs: number;
  backgroundTimeoutMs: number;
  starvationProtection: boolean;
}

/** Disk pressure configuration */
export interface DiskPressureConfig {
  warningThresholdGB: number;
  criticalThresholdGB: number;
  maxCacheSizePerUserGB: number;
  maxTotalCacheSizeGB: number;
}

/** Disk pressure level */
export type DiskPressureLevel = 'normal' | 'warning' | 'critical';

/** Session garbage collection configuration */
export interface SessionGCConfig {
  keepBehindPlayheadMinutes: number;
  maxSegmentsPerSession: number;
  gcIntervalSeconds: number;
}

// =============================================================================
// Quality Profiles
// =============================================================================

/** Transcoding quality profile */
export interface TranscodingProfile {
  name: string;
  maxHeight: number;
  maxWidth: number;
  h264Bitrate: number;
  hevcBitrate: number;
  audioBitrate: number;
  audioChannels: number;
}

/** Default quality profiles */
export const QUALITY_PROFILES: Record<string, TranscodingProfile> = {
  maximum: {
    name: 'Maximum',
    maxHeight: 2160,
    maxWidth: 3840,
    h264Bitrate: 25_000_000,
    hevcBitrate: 15_000_000,
    audioBitrate: 640_000,
    audioChannels: 6,
  },
  high: {
    name: 'High',
    maxHeight: 1080,
    maxWidth: 1920,
    h264Bitrate: 10_000_000,
    hevcBitrate: 6_000_000,
    audioBitrate: 384_000,
    audioChannels: 6,
  },
  medium: {
    name: 'Medium',
    maxHeight: 720,
    maxWidth: 1280,
    h264Bitrate: 5_000_000,
    hevcBitrate: 3_000_000,
    audioBitrate: 256_000,
    audioChannels: 2,
  },
  low: {
    name: 'Low',
    maxHeight: 480,
    maxWidth: 854,
    h264Bitrate: 2_000_000,
    hevcBitrate: 1_200_000,
    audioBitrate: 128_000,
    audioChannels: 2,
  },
  minimum: {
    name: 'Minimum',
    maxHeight: 360,
    maxWidth: 640,
    h264Bitrate: 800_000,
    hevcBitrate: 500_000,
    audioBitrate: 96_000,
    audioChannels: 2,
  },
};

// =============================================================================
// HLS Types
// =============================================================================

/** HLS segment container format */
export type HLSSegmentFormat = 'ts' | 'fmp4';

/** HLS playlist type */
export type HLSPlaylistType = 'EVENT' | 'VOD';

/** HLS segment metadata */
export interface HLSSegment {
  index: number;
  epochIndex: number;
  duration: number;
  filename: string;
  path: string;
  byteSize?: number;
  startTime: number; // Media time in seconds
  endTime: number;
  isPartial?: boolean;
  discontinuity?: boolean; // Marks start of new epoch
}

/** HLS media playlist state */
export interface HLSMediaPlaylist {
  sessionId: string;
  mediaId: string;
  epochIndex: number;
  targetDuration: number;
  mediaSequence: number;
  discontinuitySequence: number;
  playlistType: HLSPlaylistType;
  segments: HLSSegment[];
  endList: boolean;
}

/** HLS audio rendition for multi-track audio */
export interface HLSAudioRendition {
  groupId: string;
  name: string;
  language: string;
  isDefault: boolean;
  autoSelect: boolean;
  channels: number;
  uri: string;
}

/** HLS master playlist structure */
export interface HLSMasterPlaylist {
  sessionId: string;
  mediaId: string;
  variants: HLSVariant[];
  audioRenditions: HLSAudioRendition[];
}

/** HLS variant stream (quality level) */
export interface HLSVariant {
  bandwidth: number;
  averageBandwidth?: number;
  resolution?: { width: number; height: number };
  frameRate?: number;
  codecs: string;
  audioGroup?: string;
  uri: string;
}

/** Epoch transition event */
export interface EpochTransition {
  sessionId: string;
  fromEpoch: number;
  toEpoch: number;
  reason: EpochTransitionReason;
  mediaTime: number; // Source media time at transition
  timestamp: string;
}

/** Reasons for epoch transitions */
export type EpochTransitionReason =
  | 'session_start'
  | 'seek'
  | 'track_switch'
  | 'quality_change'
  | 'subtitle_toggle'
  | 'speed_change'
  | 'error_recovery';

/** FFmpeg process state */
export interface FFmpegProcessState {
  pid?: number;
  status: 'starting' | 'running' | 'paused' | 'stopping' | 'stopped' | 'error';
  startedAt?: string;
  lastOutputAt?: string;
  segmentsProduced: number;
  currentMediaTime: number;
  errorMessage?: string;
  restartCount: number;
}

/** Transcode queue job for queue management */
export interface TranscodeQueueJob {
  id: string;
  sessionId: string;
  mediaId: string;
  userId: string;
  priority: 'interactive' | 'prefetch' | 'trickplay' | 'background';
  status: 'queued' | 'active' | 'completed' | 'failed' | 'cancelled';
  playbackPlan: PlaybackPlan;
  startPosition: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress?: {
    segmentsCompleted: number;
    currentTime: number;
    estimatedTimeRemaining?: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

// =============================================================================
// Pipeline Schema Version
// =============================================================================

/**
 * Pipeline schema version - included in cache keys to invalidate
 * cached segments when the pipeline logic changes.
 */
export const PIPELINE_SCHEMA_VERSION = 1;
