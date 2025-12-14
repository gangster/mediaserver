/**
 * FFmpeg Command Builder
 *
 * Generates FFmpeg command arguments from a PlaybackPlan.
 * Handles all the complexity of building correct FFmpeg commands
 * for different playback modes, codecs, and filters.
 *
 * @see docs/TRANSCODING_PIPELINE.md §7 for specification
 */

import type {
  PlaybackPlan,
  PlaybackMode,
  FFmpegCapabilityManifest,
  VideoTrackPlan,
  AudioTrackPlan,
} from '@mediaserver/core';

/** FFmpeg command structure */
export interface FFmpegCommand {
  inputArgs: string[];
  outputArgs: string[];
  filterComplex?: string;
  hlsArgs?: string[];
}

/** Options for building FFmpeg commands */
export interface FFmpegBuildOptions {
  inputPath: string;
  outputPath: string;
  startTime?: number;
  duration?: number;
  segmentDuration: number;
  playlistFilename?: string;
}

/**
 * Build a complete FFmpeg command from a PlaybackPlan.
 */
export function buildFFmpegCommand(
  plan: PlaybackPlan,
  manifest: FFmpegCapabilityManifest,
  options: FFmpegBuildOptions
): string[] {
  const args: string[] = ['ffmpeg'];

  // Global options
  args.push('-hide_banner');
  args.push('-y'); // Overwrite output

  // Input options
  args.push(...buildInputArgs(options, plan));

  // Filter complex (if needed)
  const filterComplex = buildFilterComplex(plan, manifest);
  if (filterComplex) {
    args.push('-filter_complex', filterComplex);
  }

  // Video encoding options
  args.push(...buildVideoArgs(plan.video, plan.mode, manifest, !!filterComplex));

  // Audio encoding options
  args.push(...buildAudioArgs(plan.audio, plan.mode, manifest, !!filterComplex));

  // Subtitle handling
  if (plan.subtitles.mode === 'burn' && plan.subtitles.sourceIndex !== undefined) {
    // Subtitle burn-in is handled in filter_complex
  }

  // Output format options
  if (plan.transport === 'hls') {
    args.push(...buildHLSArgs(plan, options));
  } else {
    // Direct output
    args.push(options.outputPath);
  }

  return args;
}

/**
 * Build input arguments.
 */
function buildInputArgs(
  options: FFmpegBuildOptions,
  plan: PlaybackPlan
): string[] {
  const args: string[] = [];

  // Seek to start position (before input for fast seek)
  if (options.startTime && options.startTime > 0) {
    args.push('-ss', options.startTime.toString());
  }

  // Hardware acceleration for decoding (if available)
  if (plan.video.hwaccel && plan.video.encoder) {
    const hwaccel = getHwaccelForEncoder(plan.video.encoder);
    if (hwaccel) {
      args.push('-hwaccel', hwaccel);
      if (hwaccel === 'cuda') {
        args.push('-hwaccel_output_format', 'cuda');
      }
    }
  }

  // Input file
  args.push('-i', options.inputPath);

  // Duration limit (for segments)
  if (options.duration && options.duration > 0) {
    args.push('-t', options.duration.toString());
  }

  return args;
}

/**
 * Build filter_complex for video processing.
 */
function buildFilterComplex(
  plan: PlaybackPlan,
  manifest: FFmpegCapabilityManifest
): string | null {
  const filters: string[] = [];
  let inputLabel = '0:v:0';
  let outputLabel = 'vout';

  // Deinterlace
  if (plan.quirks.deinterlace) {
    filters.push(`[${inputLabel}]${plan.quirks.deinterlace.filter}[deint]`);
    inputLabel = 'deint';
  }

  // VFR to CFR
  if (plan.quirks.vfrToCfr) {
    filters.push(`[${inputLabel}]fps=${plan.quirks.vfrToCfr.targetFps}[cfr]`);
    inputLabel = 'cfr';
  }

  // HDR handling
  if (plan.hdr.mode === 'tonemap_sdr' && plan.hdr.tonemapFilter) {
    filters.push(`[${inputLabel}]${plan.hdr.tonemapFilter}[tonemapped]`);
    inputLabel = 'tonemapped';
  }

  // Scale (if needed)
  if (plan.video.resolution && plan.video.action === 'encode') {
    const { width, height } = plan.video.resolution;
    const scaleFilter = getScaleFilter(manifest, plan.video.hwaccel);
    filters.push(`[${inputLabel}]${scaleFilter}=${width}:${height}[scaled]`);
    inputLabel = 'scaled';
  }

  // Subtitle burn-in
  if (plan.subtitles.mode === 'burn' && plan.subtitles.sourceIndex !== undefined) {
    // Note: Subtitle burn-in typically requires the subtitles filter
    // which needs the input file path. This is handled separately.
    filters.push(`[${inputLabel}]subtitles=si=${plan.subtitles.sourceIndex}[subbed]`);
    inputLabel = 'subbed';
  }

  // Final output label
  if (filters.length > 0) {
    // Rename last output to 'vout'
    const lastFilter = filters[filters.length - 1];
    if (lastFilter) {
      filters[filters.length - 1] = lastFilter.replace(/\[[^\]]+\]$/, `[${outputLabel}]`);
    }
    return filters.join(';');
  }

  return null;
}

/**
 * Build video encoding arguments.
 */
function buildVideoArgs(
  video: VideoTrackPlan,
  _mode: PlaybackMode,
  _manifest: FFmpegCapabilityManifest,
  hasFilterComplex: boolean
): string[] {
  const args: string[] = [];

  // Map video stream
  if (hasFilterComplex) {
    args.push('-map', '[vout]');
  } else {
    args.push('-map', `0:v:${video.sourceIndex}`);
  }

  if (video.action === 'copy') {
    args.push('-c:v', 'copy');
  } else {
    // Encode
    const encoder = video.encoder ?? 'libx264';
    args.push('-c:v', encoder);

    // Encoder-specific options
    if (encoder === 'libx264' || encoder === 'libx265') {
      args.push('-preset', 'fast');
      if (video.crf) {
        args.push('-crf', video.crf.toString());
      } else {
        args.push('-crf', encoder === 'libx265' ? '28' : '23');
      }
    } else if (encoder.includes('nvenc')) {
      args.push('-preset', 'p4'); // balanced
      args.push('-rc', 'vbr');
      args.push('-cq', '23');
    } else if (encoder.includes('qsv')) {
      args.push('-preset', 'faster');
      args.push('-global_quality', '23');
    } else if (encoder.includes('videotoolbox')) {
      args.push('-q:v', '65'); // Quality 0-100
    }

    // Profile and level
    if (video.profile) {
      args.push('-profile:v', video.profile);
    }
    if (video.level) {
      args.push('-level:v', video.level);
    }

    // Bitrate (if specified)
    if (video.bitrate) {
      args.push('-b:v', video.bitrate.toString());
      args.push('-maxrate', Math.round(video.bitrate * 1.5).toString());
      args.push('-bufsize', Math.round(video.bitrate * 2).toString());
    }

    // Pixel format for 8-bit output
    args.push('-pix_fmt', 'yuv420p');
  }

  return args;
}

/**
 * Build audio encoding arguments.
 */
function buildAudioArgs(
  audio: AudioTrackPlan,
  _mode: PlaybackMode,
  _manifest: FFmpegCapabilityManifest,
  _hasFilterComplex: boolean
): string[] {
  const args: string[] = [];

  // Skip if no audio
  if (audio.sourceIndex < 0) {
    args.push('-an');
    return args;
  }

  // Map audio stream
  args.push('-map', `0:a:${audio.sourceIndex}`);

  if (audio.action === 'copy') {
    args.push('-c:a', 'copy');
  } else {
    // Encode to AAC
    args.push('-c:a', 'aac');
    args.push('-ac', audio.channels.toString());

    if (audio.bitrate) {
      args.push('-b:a', audio.bitrate.toString());
    } else {
      // Default bitrate based on channels
      const bitrate = audio.channels > 2 ? '384k' : '192k';
      args.push('-b:a', bitrate);
    }

    // Audio filters
    if (audio.filters.length > 0) {
      args.push('-af', audio.filters.join(','));
    }
  }

  return args;
}

/**
 * Build HLS-specific output arguments.
 */
function buildHLSArgs(
  plan: PlaybackPlan,
  options: FFmpegBuildOptions
): string[] {
  const args: string[] = [];

  // Output format
  args.push('-f', 'hls');

  // Segment duration
  args.push('-hls_time', options.segmentDuration.toString());

  // Keep all segments (don't delete old ones)
  args.push('-hls_list_size', '0');

  // Segment filename pattern - must match what transcode-session expects: segment_00000.ts
  const outputDir = options.outputPath.substring(0, options.outputPath.lastIndexOf('/'));
  const segmentPattern = `${outputDir}/segment_%05d.ts`;
  args.push('-hls_segment_filename', segmentPattern);

  // Playlist type - EVENT allows progressive writing while transcoding
  // We'll append #EXT-X-ENDLIST when serving if transcoding is complete
  args.push('-hls_playlist_type', 'event');

  // Start at segment 0
  args.push('-start_number', '0');

  // Timing flags for accurate seeking
  args.push('-muxdelay', '0');
  args.push('-muxpreload', '0');

  // Reset timestamps
  args.push('-avoid_negative_ts', 'make_zero');
  args.push('-start_at_zero');

  // Force keyframes at segment boundaries
  if (plan.video.action === 'encode') {
    const gopSize = Math.round(options.segmentDuration * 30); // Assume 30fps
    args.push('-g', gopSize.toString());
    args.push('-keyint_min', gopSize.toString());
    args.push('-sc_threshold', '0');
    args.push('-force_key_frames', `expr:gte(t,n_forced*${options.segmentDuration})`);
  }

  // HLS flags
  const hlsFlags = [
    'independent_segments',
  ];

  // Use fMP4 or TS based on container format
  if (plan.container === 'hls_fmp4') {
    args.push('-hls_segment_type', 'fmp4');
    // fMP4 init segment
    const initSegment = options.outputPath.replace('.m3u8', '_init.mp4');
    args.push('-hls_fmp4_init_filename', initSegment);
  }

  // Remove iframes_only for normal operation
  args.push('-hls_flags', hlsFlags.filter(f => f !== 'iframes_only').join('+'));

  // Output playlist
  args.push(options.outputPath);

  return args;
}

/**
 * Get hardware acceleration method for a given encoder.
 */
function getHwaccelForEncoder(encoder: string): string | null {
  if (encoder.includes('nvenc') || encoder.includes('cuvid')) {
    return 'cuda';
  }
  if (encoder.includes('qsv')) {
    return 'qsv';
  }
  if (encoder.includes('videotoolbox')) {
    return 'videotoolbox';
  }
  if (encoder.includes('vaapi')) {
    return 'vaapi';
  }
  return null;
}

/**
 * Get the appropriate scale filter based on hardware availability.
 */
function getScaleFilter(
  manifest: FFmpegCapabilityManifest,
  useHwaccel: boolean
): string {
  if (useHwaccel) {
    if (manifest.filters.scale_cuda) return 'scale_cuda';
    if (manifest.filters.scale_qsv) return 'scale_qsv';
  }
  return 'scale';
}

/**
 * Build FFmpeg command for audio-only transcode.
 * Used when video can be copied but audio needs transcoding.
 */
export function buildAudioOnlyTranscodeCommand(
  plan: PlaybackPlan,
  options: FFmpegBuildOptions
): string[] {
  const args: string[] = ['ffmpeg'];

  args.push('-hide_banner');
  args.push('-y');

  // Seek
  if (options.startTime && options.startTime > 0) {
    args.push('-ss', options.startTime.toString());
  }

  args.push('-i', options.inputPath);

  // Copy video
  args.push('-map', `0:v:${plan.video.sourceIndex}`);
  args.push('-c:v', 'copy');

  // Transcode audio
  args.push('-map', `0:a:${plan.audio.sourceIndex}`);
  args.push('-c:a', 'aac');
  args.push('-ac', plan.audio.channels.toString());
  args.push('-b:a', plan.audio.bitrate?.toString() ?? '192k');

  if (plan.audio.filters.length > 0) {
    args.push('-af', plan.audio.filters.join(','));
  }

  // HLS output
  if (plan.transport === 'hls') {
    args.push(...buildHLSArgs(plan, options));
  } else {
    args.push(options.outputPath);
  }

  return args;
}

/**
 * Build FFmpeg command for remux only (no transcoding).
 */
export function buildRemuxCommand(
  plan: PlaybackPlan,
  options: FFmpegBuildOptions
): string[] {
  const args: string[] = ['ffmpeg'];

  args.push('-hide_banner');
  args.push('-y');

  // Seek
  if (options.startTime && options.startTime > 0) {
    args.push('-ss', options.startTime.toString());
  }

  args.push('-i', options.inputPath);

  // Copy all streams
  args.push('-map', `0:v:${plan.video.sourceIndex}`);
  args.push('-c:v', 'copy');

  if (plan.audio.sourceIndex >= 0) {
    args.push('-map', `0:a:${plan.audio.sourceIndex}`);
    args.push('-c:a', 'copy');
  }

  // Timing
  args.push('-muxdelay', '0');
  args.push('-muxpreload', '0');
  args.push('-avoid_negative_ts', 'make_zero');
  args.push('-start_at_zero');

  // HLS output for remux-to-HLS
  if (plan.transport === 'hls') {
    args.push(...buildHLSArgs(plan, options));
  } else {
    args.push('-f', 'mp4');
    args.push('-movflags', '+faststart');
    args.push(options.outputPath);
  }

  return args;
}

/**
 * Build FFmpeg probe command for keyframe analysis.
 */
export function buildKeyframeProbeCommand(
  inputPath: string,
  startTime: number,
  duration: number
): string[] {
  return [
    'ffprobe',
    '-v', 'quiet',
    '-select_streams', 'v:0',
    '-show_entries', 'packet=pts_time,flags',
    '-of', 'csv=p=0',
    '-read_intervals', `${startTime}%+${duration}`,
    inputPath,
  ];
}

/**
 * Build FFmpeg command for generating thumbnail sprites.
 */
export function buildThumbnailSpriteCommand(
  inputPath: string,
  outputPath: string,
  interval: number = 10,
  width: number = 160,
  height: number = 90
): string[] {
  return [
    'ffmpeg',
    '-hide_banner',
    '-y',
    '-i', inputPath,
    '-vf', `fps=1/${interval},scale=${width}:${height}`,
    '-an',
    outputPath,
  ];
}

/**
 * Get the FFmpeg command as a single string (for logging).
 */
export function commandToString(args: string[]): string {
  return args
    .map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))
    .join(' ');
}

/**
 * Select the appropriate build function based on playback mode.
 */
export function buildCommandForMode(
  plan: PlaybackPlan,
  manifest: FFmpegCapabilityManifest,
  options: FFmpegBuildOptions
): string[] {
  switch (plan.mode) {
    case 'direct':
      // No command needed for direct play
      throw new Error('Direct play does not require FFmpeg');

    case 'direct_audio_transcode':
      return buildAudioOnlyTranscodeCommand(plan, options);

    case 'remux':
    case 'remux_audio_transcode':
      return buildRemuxCommand(plan, options);

    case 'remux_hls':
      return buildRemuxCommand(plan, options);

    case 'remux_hls_audio_transcode':
      return buildAudioOnlyTranscodeCommand(plan, options);

    case 'transcode_hls':
      return buildFFmpegCommand(plan, manifest, options);

    default:
      return buildFFmpegCommand(plan, manifest, options);
  }
}
