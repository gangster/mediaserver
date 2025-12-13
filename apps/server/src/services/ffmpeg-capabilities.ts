/**
 * FFmpeg Capability Detection Service
 *
 * Generates a strict capability manifest by actually testing each encoder,
 * decoder, and filter. Never assume capabilities exist—test them.
 *
 * @see docs/TRANSCODING_PIPELINE.md §3 for specification
 */

import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  FFmpegCapabilityManifest,
  EncoderSupport,
  DecoderSupport,
  FilterSupport,
  HWAccelSupport,
  DolbyVisionSupport,
} from '@mediaserver/core';
import { logger } from '../lib/logger.js';

const exec = promisify(execCallback);

/** Timeout for each capability test (ms) */
const TEST_TIMEOUT = 10_000;

/**
 * Execute a command with timeout and capture result.
 * Returns true if command succeeds, false otherwise.
 */
async function testCommand(cmd: string): Promise<boolean> {
  try {
    await exec(cmd, { timeout: TEST_TIMEOUT });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get FFmpeg version string.
 */
async function getFFmpegVersion(): Promise<string> {
  try {
    const { stdout } = await exec('ffmpeg -version', { timeout: TEST_TIMEOUT });
    const match = stdout.match(/ffmpeg version (\S+)/);
    return match?.[1] ?? 'unknown';
  } catch {
    return 'unavailable';
  }
}

/**
 * Get FFprobe version string.
 */
async function getFFprobeVersion(): Promise<string> {
  try {
    const { stdout } = await exec('ffprobe -version', { timeout: TEST_TIMEOUT });
    const match = stdout.match(/ffprobe version (\S+)/);
    return match?.[1] ?? 'unknown';
  } catch {
    return 'unavailable';
  }
}

/**
 * Test if an encoder is available and functional.
 * Actually tries to encode 3 frames to verify it works.
 */
async function testEncoder(encoder: string): Promise<boolean> {
  const cmd = `ffmpeg -y -f lavfi -i color=c=black:s=64x64:d=0.1 -c:v ${encoder} -frames:v 3 -f null - 2>&1`;
  return testCommand(cmd);
}

/**
 * Test if an audio encoder is available.
 */
async function testAudioEncoder(encoder: string): Promise<boolean> {
  const cmd = `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 0.1 -c:a ${encoder} -f null - 2>&1`;
  return testCommand(cmd);
}

/**
 * Test if a filter is available.
 */
async function testFilter(filterChain: string): Promise<boolean> {
  const cmd = `ffmpeg -y -f lavfi -i color=c=black:s=64x64:d=0.1 -vf "${filterChain}" -frames:v 3 -f null - 2>&1`;
  return testCommand(cmd);
}

/**
 * Test if an audio filter is available.
 */
async function testAudioFilter(filterChain: string): Promise<boolean> {
  const cmd = `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 0.1 -af "${filterChain}" -f null - 2>&1`;
  return testCommand(cmd);
}

/**
 * Check if a hardware acceleration method is available.
 */
async function testHwaccel(method: string): Promise<boolean> {
  try {
    const { stdout } = await exec('ffmpeg -hwaccels', { timeout: TEST_TIMEOUT });
    return stdout.toLowerCase().includes(method.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Check if a decoder is available in FFmpeg.
 */
async function testDecoder(decoder: string): Promise<boolean> {
  try {
    const { stdout } = await exec('ffmpeg -decoders', { timeout: TEST_TIMEOUT });
    return stdout.includes(decoder);
  } catch {
    return false;
  }
}

/**
 * Test all hardware acceleration methods.
 */
async function detectHwaccelSupport(): Promise<HWAccelSupport> {
  logger.info('Testing hardware acceleration support...');

  const [cuda, nvdec, qsv, vaapi, videotoolbox, d3d11va] = await Promise.all([
    testHwaccel('cuda'),
    testHwaccel('nvdec'),
    testHwaccel('qsv'),
    testHwaccel('vaapi'),
    testHwaccel('videotoolbox'),
    testHwaccel('d3d11va'),
  ]);

  return { cuda, nvdec, qsv, vaapi, videotoolbox, d3d11va };
}

/**
 * Test all video and audio encoders.
 */
async function detectEncoderSupport(): Promise<EncoderSupport> {
  logger.info('Testing encoder support...');

  // Test video encoders in parallel batches to avoid overwhelming the system
  const [
    // Software video
    libx264,
    libx265,
    libsvtav1,
    libvpx_vp9,
    // NVIDIA
    h264_nvenc,
    hevc_nvenc,
    av1_nvenc,
    // Intel QSV
    h264_qsv,
    hevc_qsv,
    av1_qsv,
    // AMD
    h264_amf,
    hevc_amf,
    // Apple
    h264_videotoolbox,
    hevc_videotoolbox,
  ] = await Promise.all([
    testEncoder('libx264'),
    testEncoder('libx265'),
    testEncoder('libsvtav1'),
    testEncoder('libvpx-vp9'),
    testEncoder('h264_nvenc'),
    testEncoder('hevc_nvenc'),
    testEncoder('av1_nvenc'),
    testEncoder('h264_qsv'),
    testEncoder('hevc_qsv'),
    testEncoder('av1_qsv'),
    testEncoder('h264_amf'),
    testEncoder('hevc_amf'),
    testEncoder('h264_videotoolbox'),
    testEncoder('hevc_videotoolbox'),
  ]);

  // Test audio encoders
  const [aac, libopus] = await Promise.all([
    testAudioEncoder('aac'),
    testAudioEncoder('libopus'),
  ]);

  return {
    libx264,
    libx265,
    libsvtav1,
    libvpx_vp9,
    aac,
    libopus,
    h264_nvenc,
    hevc_nvenc,
    av1_nvenc,
    h264_qsv,
    hevc_qsv,
    av1_qsv,
    h264_amf,
    hevc_amf,
    h264_videotoolbox,
    hevc_videotoolbox,
  };
}

/**
 * Test hardware decoder support.
 */
async function detectDecoderSupport(): Promise<DecoderSupport> {
  logger.info('Testing decoder support...');

  const [h264_cuvid, hevc_cuvid, av1_cuvid, h264_qsv, hevc_qsv] =
    await Promise.all([
      testDecoder('h264_cuvid'),
      testDecoder('hevc_cuvid'),
      testDecoder('av1_cuvid'),
      testDecoder('h264_qsv'),
      testDecoder('hevc_qsv'),
    ]);

  return { h264_cuvid, hevc_cuvid, av1_cuvid, h264_qsv, hevc_qsv };
}

/**
 * Test filter support.
 */
async function detectFilterSupport(): Promise<FilterSupport> {
  logger.info('Testing filter support...');

  const [
    // Tone mapping
    tonemap,
    tonemap_cuda,
    tonemap_opencl,
    zscale,
    // Deinterlacing
    yadif,
    yadif_cuda,
    bwdif,
    bwdif_cuda,
    // Scaling
    scale,
    scale_cuda,
    scale_qsv,
    // Subtitles
    subtitles,
    // Audio
    loudnorm,
    atempo,
  ] = await Promise.all([
    testFilter('tonemap=hable'),
    testFilter('tonemap_cuda=tonemap=hable'),
    testFilter('tonemap_opencl=tonemap=hable'),
    testFilter('zscale=t=linear'),
    testFilter('yadif'),
    testFilter('yadif_cuda'),
    testFilter('bwdif'),
    testFilter('bwdif_cuda'),
    testFilter('scale=64:64'),
    testFilter('scale_cuda=64:64'),
    testFilter('scale_qsv=64:64'),
    // Subtitles filter needs a subtitle file, so just check if it's listed
    testCommand('ffmpeg -filters 2>&1 | grep -q subtitles'),
    testAudioFilter('loudnorm=I=-16'),
    testAudioFilter('atempo=1.0'),
  ]);

  return {
    tonemap,
    tonemap_cuda,
    tonemap_opencl,
    zscale,
    yadif,
    yadif_cuda,
    bwdif,
    bwdif_cuda,
    scale,
    scale_cuda,
    scale_qsv,
    subtitles,
    loudnorm,
    atempo,
  };
}

/**
 * Test Dolby Vision handling capabilities.
 *
 * Note: Full DV testing requires actual DV content, so we make conservative
 * assumptions based on FFmpeg version and available tools.
 */
async function detectDolbyVisionSupport(
  ffmpegVersion: string
): Promise<DolbyVisionSupport> {
  logger.info('Testing Dolby Vision support...');

  // Most FFmpeg builds can detect DV via side_data
  const canDetect = true;

  // These capabilities depend on FFmpeg version and build options
  // FFmpeg 5.0+ has better DV support
  const versionNum = parseFloat(ffmpegVersion.split('.').slice(0, 2).join('.'));
  const hasModernFFmpeg = !isNaN(versionNum) && versionNum >= 5.0;

  // Check for dovi_tool or similar in PATH (for P8 base layer extraction)
  const hasDovitool = await testCommand('which dovi_tool');

  return {
    canDetect,
    // P8 base layer extraction requires specific FFmpeg builds or dovi_tool
    canExtractHDR10Base: hasDovitool || hasModernFFmpeg,
    // P5/P8 to HDR10 conversion
    canConvertToHDR10: hasModernFFmpeg,
    // Tone mapping from DV requires zscale + tonemap or GPU tonemap
    canTonemap: hasModernFFmpeg,
  };
}

/**
 * Generate a complete FFmpeg capability manifest.
 *
 * This function tests all encoders, decoders, filters, and hardware
 * acceleration methods to build a comprehensive picture of what this
 * FFmpeg installation can do.
 */
export async function generateFFmpegManifest(): Promise<FFmpegCapabilityManifest> {
  const startTime = Date.now();
  logger.info('Generating FFmpeg capability manifest...');

  // Get versions first
  const [ffmpegVersion, ffprobeVersion] = await Promise.all([
    getFFmpegVersion(),
    getFFprobeVersion(),
  ]);

  logger.info(`FFmpeg version: ${ffmpegVersion}`);
  logger.info(`FFprobe version: ${ffprobeVersion}`);

  // Run all detection in parallel where possible
  const [hwaccel, encoders, decoders, filters, dolbyVision] = await Promise.all(
    [
      detectHwaccelSupport(),
      detectEncoderSupport(),
      detectDecoderSupport(),
      detectFilterSupport(),
      detectDolbyVisionSupport(ffmpegVersion),
    ]
  );

  const generationDurationMs = Date.now() - startTime;

  const manifest: FFmpegCapabilityManifest = {
    ffmpegVersion,
    ffprobeVersion,
    hwaccel,
    encoders,
    decoders,
    filters,
    dolbyVision,
    generatedAt: new Date().toISOString(),
    generationDurationMs,
  };

  logger.info({ generationDurationMs }, 'FFmpeg capability manifest generated');
  logManifestSummary(manifest);

  return manifest;
}

/**
 * Log a summary of the manifest for debugging.
 */
function logManifestSummary(manifest: FFmpegCapabilityManifest): void {
  const hwaccelList = Object.entries(manifest.hwaccel)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const encoderList = Object.entries(manifest.encoders)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const filterList = Object.entries(manifest.filters)
    .filter(([, v]) => v)
    .map(([k]) => k);

  logger.info(
    {
      hwaccel: hwaccelList.length > 0 ? hwaccelList.join(', ') : 'none',
      encoders: encoderList.join(', '),
      filters: filterList.join(', '),
      dolbyVision: manifest.dolbyVision,
    },
    'FFmpeg Capability Summary'
  );
}

/**
 * Check if a specific encoder is available in the manifest.
 */
export function hasEncoder(
  manifest: FFmpegCapabilityManifest,
  encoder: keyof EncoderSupport
): boolean {
  return manifest.encoders[encoder] ?? false;
}

/**
 * Check if a specific filter is available in the manifest.
 */
export function hasFilter(
  manifest: FFmpegCapabilityManifest,
  filter: keyof FilterSupport
): boolean {
  return manifest.filters[filter] ?? false;
}

/**
 * Get the best available H.264 encoder.
 */
export function getBestH264Encoder(
  manifest: FFmpegCapabilityManifest
): string | null {
  // Prefer hardware encoders in order of quality/speed
  if (manifest.encoders.h264_nvenc) return 'h264_nvenc';
  if (manifest.encoders.h264_videotoolbox) return 'h264_videotoolbox';
  if (manifest.encoders.h264_qsv) return 'h264_qsv';
  if (manifest.encoders.h264_amf) return 'h264_amf';
  if (manifest.encoders.libx264) return 'libx264';
  return null;
}

/**
 * Get the best available HEVC encoder.
 */
export function getBestHEVCEncoder(
  manifest: FFmpegCapabilityManifest
): string | null {
  if (manifest.encoders.hevc_nvenc) return 'hevc_nvenc';
  if (manifest.encoders.hevc_videotoolbox) return 'hevc_videotoolbox';
  if (manifest.encoders.hevc_qsv) return 'hevc_qsv';
  if (manifest.encoders.hevc_amf) return 'hevc_amf';
  if (manifest.encoders.libx265) return 'libx265';
  return null;
}

/**
 * Get the best available tone mapping filter chain.
 */
export function getToneMapFilter(
  manifest: FFmpegCapabilityManifest
): string | null {
  // Prefer GPU-accelerated tone mapping
  if (manifest.hwaccel.cuda && manifest.filters.tonemap_cuda) {
    return 'tonemap_cuda=tonemap=hable:desat=0:format=yuv420p';
  }

  // Software tone mapping with zscale
  if (manifest.filters.zscale && manifest.filters.tonemap) {
    return 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';
  }

  return null;
}

/**
 * Get the best available deinterlace filter.
 */
export function getDeinterlaceFilter(
  manifest: FFmpegCapabilityManifest,
  fieldOrder: 'tff' | 'bff' = 'tff'
): string | null {
  const fieldParam = fieldOrder === 'tff' ? '0' : '1';

  // Prefer GPU deinterlacing
  if (manifest.hwaccel.cuda && manifest.filters.yadif_cuda) {
    return `yadif_cuda=0:${fieldParam}:0`;
  }
  if (manifest.filters.bwdif) {
    return `bwdif=0:${fieldParam}:0`;
  }
  if (manifest.filters.yadif) {
    return `yadif=0:${fieldParam}:0`;
  }

  return null;
}

/**
 * Check if the manifest indicates transcoding is possible.
 * At minimum, we need libx264 and aac.
 */
export function canTranscode(manifest: FFmpegCapabilityManifest): boolean {
  return manifest.encoders.libx264 && manifest.encoders.aac;
}
