/**
 * Enhanced Media Probe Service for Transcoding Pipeline
 *
 * Extends basic FFprobe functionality with:
 * - HDR format detection (HDR10, DV profiles, HLG)
 * - Keyframe analysis for HLS segmentation decisions
 * - Content quirks detection (interlaced, VFR, telecined)
 * - Chapter extraction
 *
 * @see docs/TRANSCODING_PIPELINE.md §4 for specification
 */

import { exec as execCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';
import type {
  MediaProbeResult,
  VideoStreamInfo,
  AudioStreamInfo,
  SubtitleStreamInfo,
  ChapterInfo,
  FormatInfo,
  KeyframeAnalysis,
  ContentQuirks,
  HDRFormat,
} from '@mediaserver/core';
import { logger } from '../lib/logger.js';

const exec = promisify(execCallback);

/** FFprobe command timeout (ms) */
const PROBE_TIMEOUT = 30_000;

/** Keyframe analysis timeout (ms) */
const KEYFRAME_TIMEOUT = 60_000;

/** Number of keyframe samples for analysis */
const KEYFRAME_SAMPLE_DURATION = 60; // seconds to sample

/** FFprobe JSON output format */
interface FFprobeOutput {
  format: FFprobeFormat;
  streams: FFprobeStream[];
  chapters?: FFprobeChapter[];
}

interface FFprobeFormat {
  filename: string;
  duration: string;
  bit_rate: string;
  size: string;
  format_name: string;
  format_long_name: string;
  start_time?: string;
  tags?: Record<string, string>;
}

interface FFprobeStream {
  index: number;
  codec_name: string;
  codec_long_name: string;
  codec_type: 'video' | 'audio' | 'subtitle' | 'attachment' | 'data';
  codec_tag_string: string;
  profile?: string;
  width?: number;
  height?: number;
  coded_width?: number;
  coded_height?: number;
  display_aspect_ratio?: string;
  pix_fmt?: string;
  level?: number;
  color_range?: string;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  field_order?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  bits_per_raw_sample?: string;
  bit_rate?: string;
  duration?: string;
  nb_frames?: string;
  side_data_list?: FFprobeSideData[];
  tags?: {
    language?: string;
    title?: string;
    handler_name?: string;
    BPS?: string;
    DURATION?: string;
  };
  disposition?: {
    default: number;
    forced: number;
    hearing_impaired: number;
    visual_impaired: number;
    comment: number;
  };
}

interface FFprobeSideData {
  side_data_type: string;
  dv_version_major?: number;
  dv_version_minor?: number;
  dv_profile?: number;
  dv_level?: number;
  rpu_present_flag?: number;
  el_present_flag?: number;
  bl_present_flag?: number;
  max_content?: number;
  max_average?: number;
  red_x?: string;
  red_y?: string;
  green_x?: string;
  green_y?: string;
  blue_x?: string;
  blue_y?: string;
  white_point_x?: string;
  white_point_y?: string;
  min_luminance?: string;
  max_luminance?: string;
}

interface FFprobeChapter {
  id: number;
  time_base: string;
  start: number;
  start_time: string;
  end: number;
  end_time: string;
  tags?: {
    title?: string;
  };
}

/**
 * Run FFprobe on a file and return JSON output.
 */
async function runFFprobe(filePath: string): Promise<FFprobeOutput> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-show_chapters',
      filePath,
    ];

    const proc = spawn('ffprobe', args);
    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`FFprobe timed out after ${PROBE_TIMEOUT}ms`));
    }, PROBE_TIMEOUT);

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`FFprobe failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const output = JSON.parse(stdout) as FFprobeOutput;
        resolve(output);
      } catch (err) {
        reject(new Error(`Failed to parse FFprobe output: ${err}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn FFprobe: ${err.message}`));
    });
  });
}

/**
 * Parse frame rate string (e.g., "24000/1001") to number.
 */
function parseFrameRate(frameRate?: string): number {
  if (!frameRate || frameRate === '0/0') return 0;

  const parts = frameRate.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (den > 0) return num / den;
  }

  return parseFloat(frameRate) || 0;
}

/**
 * Detect HDR format from stream data.
 */
function detectHDRFormat(stream: FFprobeStream): HDRFormat {
  // Check for Dolby Vision via side_data
  const dvSideData = stream.side_data_list?.find(
    (sd) => sd.side_data_type === 'DOVI configuration record'
  );

  if (dvSideData && dvSideData.dv_profile !== undefined) {
    const profile = dvSideData.dv_profile;
    if (profile === 5) return 'dv_p5';
    if (profile === 7) return 'dv_p7';
    if (profile === 8) return 'dv_p8';
    // Other DV profiles, treat as P8 (most common)
    return 'dv_p8';
  }

  // Check for HDR10+ via side_data
  const hdr10PlusSideData = stream.side_data_list?.find(
    (sd) => sd.side_data_type === 'HDR Dynamic Metadata SMPTE2094-40'
  );
  if (hdr10PlusSideData) {
    return 'hdr10plus';
  }

  // Check for HDR10 via SMPTE ST 2086 mastering display metadata
  const masteringDisplay = stream.side_data_list?.find(
    (sd) => sd.side_data_type === 'Mastering display metadata'
  );

  // Check color transfer for HDR indicators
  const colorTransfer = stream.color_transfer?.toLowerCase() ?? '';

  // HLG detection
  if (colorTransfer === 'arib-std-b67') {
    return 'hlg';
  }

  // HDR10 detection (PQ transfer + BT.2020 primaries)
  if (colorTransfer === 'smpte2084') {
    return masteringDisplay ? 'hdr10' : 'hdr10';
  }

  // Check for BT.2020 color space (potential HDR)
  if (stream.color_primaries === 'bt2020') {
    if (colorTransfer === 'smpte2084') return 'hdr10';
    if (colorTransfer === 'arib-std-b67') return 'hlg';
  }

  // Check for 10-bit pixel format (might be HDR)
  if (stream.pix_fmt?.includes('10le') || stream.pix_fmt?.includes('10be')) {
    if (colorTransfer === 'smpte2084') return 'hdr10';
  }

  return 'sdr';
}

/**
 * Detect content quirks that require special handling.
 */
function detectContentQuirks(
  streams: FFprobeStream[],
  format: FFprobeFormat
): ContentQuirks {
  const videoStream = streams.find((s) => s.codec_type === 'video');
  const audioStream = streams.find((s) => s.codec_type === 'audio');

  const quirks: ContentQuirks = {
    isInterlaced: false,
    isVariableFrameRate: false,
    isTelecined: false,
    hasAudioSyncIssue: false,
    isLegacyContainer: false,
  };

  if (!videoStream) return quirks;

  // Interlace detection
  const fieldOrder = videoStream.field_order?.toLowerCase() ?? '';
  if (fieldOrder === 'tt' || fieldOrder === 'tb' || fieldOrder === 'tff') {
    quirks.isInterlaced = true;
    quirks.interlaceType = 'tff';
  } else if (fieldOrder === 'bb' || fieldOrder === 'bt' || fieldOrder === 'bff') {
    quirks.isInterlaced = true;
    quirks.interlaceType = 'bff';
  }

  // VFR detection - compare r_frame_rate vs avg_frame_rate
  const rFrameRate = parseFrameRate(videoStream.r_frame_rate);
  const avgFrameRate = parseFrameRate(videoStream.avg_frame_rate);

  if (rFrameRate > 0 && avgFrameRate > 0) {
    const variance = Math.abs(rFrameRate - avgFrameRate) / avgFrameRate;
    if (variance > 0.1) {
      // More than 10% difference indicates VFR
      quirks.isVariableFrameRate = true;
      quirks.vfrRange = {
        min: Math.min(rFrameRate, avgFrameRate),
        max: Math.max(rFrameRate, avgFrameRate),
        avg: avgFrameRate,
      };
    }
  }

  // Telecine detection (23.976 content at 29.97)
  if (
    (avgFrameRate > 29 && avgFrameRate < 30) &&
    videoStream.codec_name === 'mpeg2video'
  ) {
    quirks.isTelecined = true;
  }

  // Legacy container detection
  const formatName = format.format_name.toLowerCase();
  if (
    formatName.includes('avi') ||
    formatName.includes('wmv') ||
    formatName.includes('asf') ||
    formatName.includes('flv') ||
    formatName.includes('rm') ||
    formatName.includes('rmvb')
  ) {
    quirks.isLegacyContainer = true;
    quirks.containerName = format.format_name;
  }

  // Audio sync issue detection (negative start time or large offset)
  const videoStart = parseFloat(videoStream.tags?.DURATION?.split(':')[0] ?? '0');
  const audioStart = audioStream
    ? parseFloat(audioStream.tags?.DURATION?.split(':')[0] ?? '0')
    : 0;

  if (Math.abs(videoStart - audioStart) > 0.5) {
    quirks.hasAudioSyncIssue = true;
    quirks.audioSyncOffsetMs = Math.round((audioStart - videoStart) * 1000);
  }

  return quirks;
}

/**
 * Parse video stream from FFprobe output.
 */
function parseVideoStream(stream: FFprobeStream, index: number): VideoStreamInfo {
  const hdrFormat = detectHDRFormat(stream);

  return {
    index,
    codec: stream.codec_name,
    profile: stream.profile,
    level: stream.level,
    width: stream.width ?? 0,
    height: stream.height ?? 0,
    bitrate: stream.bit_rate ? parseInt(stream.bit_rate, 10) : undefined,
    frameRate: parseFrameRate(stream.avg_frame_rate),
    isHDR: hdrFormat !== 'sdr',
    hdrFormat: hdrFormat !== 'sdr' ? hdrFormat : undefined,
    colorSpace: stream.color_space,
    colorTransfer: stream.color_transfer,
    colorPrimaries: stream.color_primaries,
    isDefault: stream.disposition?.default === 1,
  };
}

/**
 * Parse audio stream from FFprobe output.
 */
function parseAudioStream(stream: FFprobeStream, index: number): AudioStreamInfo {
  const title = stream.tags?.title?.toLowerCase() ?? '';

  return {
    index,
    codec: stream.codec_name,
    channels: stream.channels ?? 2,
    channelLayout: stream.channel_layout,
    sampleRate: stream.sample_rate ? parseInt(stream.sample_rate, 10) : 48000,
    bitrate: stream.bit_rate ? parseInt(stream.bit_rate, 10) : undefined,
    language: stream.tags?.language,
    title: stream.tags?.title,
    isDefault: stream.disposition?.default === 1,
    isCommentary:
      stream.disposition?.comment === 1 ||
      title.includes('comment') ||
      title.includes('director'),
  };
}

/**
 * Parse subtitle stream from FFprobe output.
 */
function parseSubtitleStream(
  stream: FFprobeStream,
  index: number
): SubtitleStreamInfo {
  const codec = stream.codec_name.toLowerCase();
  const isText =
    codec === 'subrip' ||
    codec === 'srt' ||
    codec === 'ass' ||
    codec === 'ssa' ||
    codec === 'webvtt' ||
    codec === 'mov_text';

  const title = stream.tags?.title?.toLowerCase() ?? '';

  return {
    index,
    codec: stream.codec_name,
    language: stream.tags?.language,
    title: stream.tags?.title,
    isForced: stream.disposition?.forced === 1,
    isDefault: stream.disposition?.default === 1,
    isSDH:
      stream.disposition?.hearing_impaired === 1 ||
      title.includes('sdh') ||
      title.includes('cc') ||
      title.includes('hearing'),
    isText,
  };
}

/**
 * Parse chapters from FFprobe output.
 */
function parseChapters(chapters: FFprobeChapter[]): ChapterInfo[] {
  return chapters.map((ch, index) => ({
    index,
    startTime: parseFloat(ch.start_time),
    endTime: parseFloat(ch.end_time),
    title: ch.tags?.title,
  }));
}

/**
 * Analyze keyframe intervals in the video.
 *
 * This is critical for determining if remux-to-HLS is viable
 * (requires keyframes at regular, reasonable intervals).
 */
async function analyzeKeyframes(
  filePath: string,
  duration: number
): Promise<KeyframeAnalysis> {
  // Sample three regions: start, middle, end
  const sampleRegions: string[] = [];
  const intervals: number[] = [];

  // Calculate sample points
  const samplePoints = [
    0, // Start
    Math.max(0, duration / 2 - KEYFRAME_SAMPLE_DURATION / 2), // Middle
    Math.max(0, duration - KEYFRAME_SAMPLE_DURATION), // End
  ];

  for (let i = 0; i < samplePoints.length; i++) {
    const startTime = samplePoints[i] ?? 0;
    const regionName = ['start', 'middle', 'end'][i] ?? 'unknown';

    try {
      const keyframes = await getKeyframesInRange(
        filePath,
        startTime,
        KEYFRAME_SAMPLE_DURATION
      );

      if (keyframes.length > 1) {
        sampleRegions.push(regionName);

        // Calculate intervals between keyframes
        for (let j = 1; j < keyframes.length; j++) {
          const interval = (keyframes[j] ?? 0) - (keyframes[j - 1] ?? 0);
          if (interval > 0) {
            intervals.push(interval);
          }
        }
      }
    } catch (error) {
      logger.warn({ error, regionName }, 'Keyframe analysis failed for region');
    }
  }

  if (intervals.length === 0) {
    // No keyframes found - assume worst case
    return {
      maxInterval: 999,
      avgInterval: 999,
      isRegular: false,
      confidence: 'estimated',
      sampleRegions: [],
    };
  }

  const maxInterval = Math.max(...intervals);
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  // Check regularity - variance should be low for regular keyframes
  const variance =
    intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) /
    intervals.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / avgInterval;

  // Regular if CV < 20%
  const isRegular = coefficientOfVariation < 0.2;

  return {
    maxInterval,
    avgInterval,
    isRegular,
    confidence: sampleRegions.length >= 2 ? 'high' : 'sampled',
    sampleRegions,
  };
}

/**
 * Get keyframe timestamps in a time range.
 */
async function getKeyframesInRange(
  filePath: string,
  startTime: number,
  duration: number
): Promise<number[]> {
  const cmd = `ffprobe -v quiet -select_streams v:0 -show_entries packet=pts_time,flags -of csv=p=0 -read_intervals ${startTime}%+${duration} "${filePath}" 2>/dev/null | grep -E ",K" | cut -d',' -f1 | head -100`;

  try {
    const { stdout } = await exec(cmd, { timeout: KEYFRAME_TIMEOUT });
    return stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => parseFloat(line))
      .filter((n) => !isNaN(n));
  } catch {
    return [];
  }
}

/**
 * Generate a fingerprint for the media file.
 * Used for cache invalidation when file changes.
 */
async function generateFingerprint(
  filePath: string
): Promise<{ fingerprint: string; mtime: number; fileSize: number }> {
  const stats = await stat(filePath);
  const fileSize = stats.size;
  const mtime = Math.floor(stats.mtimeMs);

  return {
    fingerprint: `${fileSize}_${mtime}`,
    mtime,
    fileSize,
  };
}

/**
 * Get FFprobe version.
 */
async function getFFprobeVersion(): Promise<string> {
  try {
    const { stdout } = await exec('ffprobe -version', { timeout: 5000 });
    const match = stdout.match(/ffprobe version (\S+)/);
    return match?.[1] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Probe a media file with full analysis for transcoding decisions.
 *
 * This is the main entry point for media analysis.
 */
export async function probeMedia(
  filePath: string,
  options: {
    analyzeKeyframes?: boolean;
  } = {}
): Promise<MediaProbeResult> {
  const startTime = Date.now();
  let scanAttempts = 1;

  logger.info({ filePath }, 'Probing media file');

  // Get file metadata
  const { fingerprint, mtime, fileSize } = await generateFingerprint(filePath);

  // Run FFprobe
  let output: FFprobeOutput;
  try {
    output = await runFFprobe(filePath);
  } catch (error) {
    scanAttempts++;
    // Retry once
    logger.warn({ error, filePath }, 'FFprobe failed, retrying...');
    output = await runFFprobe(filePath);
  }

  // Parse format info
  const format: FormatInfo = {
    name: output.format.format_name,
    duration: parseFloat(output.format.duration) || 0,
    bitrate: parseInt(output.format.bit_rate, 10) || 0,
    startTime: parseFloat(output.format.start_time ?? '0'),
  };

  // Parse streams
  const videoStreams: VideoStreamInfo[] = [];
  const audioStreams: AudioStreamInfo[] = [];
  const subtitleStreams: SubtitleStreamInfo[] = [];

  let videoIndex = 0;
  let audioIndex = 0;
  let subtitleIndex = 0;

  for (const stream of output.streams) {
    switch (stream.codec_type) {
      case 'video':
        videoStreams.push(parseVideoStream(stream, videoIndex++));
        break;
      case 'audio':
        audioStreams.push(parseAudioStream(stream, audioIndex++));
        break;
      case 'subtitle':
        subtitleStreams.push(parseSubtitleStream(stream, subtitleIndex++));
        break;
    }
  }

  // Parse chapters
  const chapters = output.chapters ? parseChapters(output.chapters) : [];

  // Detect content quirks
  const contentQuirks = detectContentQuirks(output.streams, output.format);

  // Optional keyframe analysis (can be slow for long files)
  let keyframeAnalysis: KeyframeAnalysis | undefined;
  if (options.analyzeKeyframes !== false && format.duration > 0) {
    try {
      keyframeAnalysis = await analyzeKeyframes(filePath, format.duration);
    } catch (error) {
      logger.warn({ error, filePath }, 'Keyframe analysis failed');
    }
  }

  const scanDurationMs = Date.now() - startTime;
  const ffprobeVersion = await getFFprobeVersion();

  const result: MediaProbeResult = {
    filePath,
    fileSize,
    mtime,
    fingerprint,
    format,
    videoStreams,
    audioStreams,
    subtitleStreams,
    chapters,
    keyframeAnalysis,
    contentQuirks,
    scannedAt: new Date().toISOString(),
    scanDurationMs,
    scanAttempts,
    ffprobeVersion,
  };

  logger.info(
    {
      filePath,
      duration: format.duration,
      videoStreams: videoStreams.length,
      audioStreams: audioStreams.length,
      subtitleStreams: subtitleStreams.length,
      scanDurationMs,
    },
    'Media probe complete'
  );

  return result;
}

/**
 * Quick probe for basic info without keyframe analysis.
 */
export async function probeMediaQuick(filePath: string): Promise<MediaProbeResult> {
  return probeMedia(filePath, { analyzeKeyframes: false });
}
