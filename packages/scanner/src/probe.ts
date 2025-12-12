/**
 * Media file probing using FFprobe.
 *
 * Extracts technical metadata from media files including duration,
 * codecs, resolution, and stream information.
 */

import { spawn } from 'node:child_process';
import type { MediaStream } from '@mediaserver/core';
import type { ProbeResult } from './types.js';

/** FFprobe output format */
interface FFprobeOutput {
  format: {
    filename: string;
    duration: string;
    bit_rate: string;
    size: string;
    format_name: string;
    format_long_name: string;
  };
  streams: FFprobeStream[];
}

/** FFprobe stream data */
interface FFprobeStream {
  index: number;
  codec_name: string;
  codec_long_name: string;
  codec_type: 'video' | 'audio' | 'subtitle' | 'attachment';
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
  tags?: {
    language?: string;
    title?: string;
    BPS?: string;
    DURATION?: string;
    NUMBER_OF_FRAMES?: string;
    handler_name?: string;
  };
  disposition?: {
    default: number;
    forced: number;
    hearing_impaired: number;
    visual_impaired: number;
  };
}

/** Codecs that can be direct played by most clients */
const DIRECT_PLAY_VIDEO_CODECS = ['h264', 'hevc', 'h265', 'vp9', 'av1'];
const DIRECT_PLAY_AUDIO_CODECS = ['aac', 'ac3', 'eac3', 'mp3', 'flac', 'opus'];

/** Containers that support direct play */
const DIRECT_PLAY_CONTAINERS = ['mp4', 'mkv', 'webm', 'mov'];

/**
 * Media file prober.
 *
 * Uses FFprobe to extract metadata from media files.
 */
export class MediaProbe {
  private ffprobePath: string;

  constructor(ffprobePath = 'ffprobe') {
    this.ffprobePath = ffprobePath;
  }

  /**
   * Probes a media file to extract metadata.
   */
  async probe(filePath: string): Promise<ProbeResult> {
    const output = await this.runFFprobe(filePath);
    return this.parseOutput(output);
  }

  /**
   * Runs FFprobe on a file and returns JSON output.
   */
  private async runFFprobe(filePath: string): Promise<FFprobeOutput> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
      ];

      const proc = spawn(this.ffprobePath, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
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
        reject(new Error(`Failed to spawn FFprobe: ${err.message}`));
      });
    });
  }

  /**
   * Parses FFprobe output into a ProbeResult.
   */
  private parseOutput(output: FFprobeOutput): ProbeResult {
    const streams: MediaStream[] = output.streams.map((s) => this.parseStream(s));

    const videoStream = output.streams.find((s) => s.codec_type === 'video');
    const audioStream = output.streams.find((s) => s.codec_type === 'audio');

    const duration = parseFloat(output.format.duration) || 0;
    const bitrate = parseInt(output.format.bit_rate, 10) || undefined;

    const videoCodec = videoStream?.codec_name;
    const audioCodec = audioStream?.codec_name;
    const width = videoStream?.width;
    const height = videoStream?.height;

    // Determine resolution label
    let resolution: string | undefined;
    if (height) {
      if (height >= 2160) resolution = '4K';
      else if (height >= 1080) resolution = '1080p';
      else if (height >= 720) resolution = '720p';
      else if (height >= 480) resolution = '480p';
      else resolution = 'SD';
    }

    // Check direct playability
    const container = output.format.format_name.split(',')[0] ?? '';
    const canDirectPlayContainer = DIRECT_PLAY_CONTAINERS.some(
      (c) => container.includes(c)
    );
    const canDirectPlayVideo = !videoCodec || DIRECT_PLAY_VIDEO_CODECS.includes(videoCodec.toLowerCase());
    const canDirectPlayAudio = !audioCodec || DIRECT_PLAY_AUDIO_CODECS.includes(audioCodec.toLowerCase());

    const directPlayable = canDirectPlayContainer && canDirectPlayVideo && canDirectPlayAudio;
    const needsTranscode = !directPlayable;

    return {
      duration,
      videoCodec,
      audioCodec,
      resolution,
      width,
      height,
      bitrate,
      streams,
      directPlayable,
      needsTranscode,
    };
  }

  /**
   * Parses an FFprobe stream into a MediaStream.
   */
  private parseStream(stream: FFprobeStream): MediaStream {
    const base = {
      index: stream.index,
      codec: stream.codec_name,
      codecLongName: stream.codec_long_name,
      language: stream.tags?.language,
      title: stream.tags?.title,
      isDefault: stream.disposition?.default === 1,
    };

    switch (stream.codec_type) {
      case 'video':
        return {
          ...base,
          type: 'video',
          width: stream.width,
          height: stream.height,
          frameRate: this.parseFrameRate(stream.r_frame_rate),
          profile: stream.profile,
          level: stream.level,
          pixelFormat: stream.pix_fmt,
          colorSpace: stream.color_space,
          hdr: this.isHDR(stream),
        };

      case 'audio':
        return {
          ...base,
          type: 'audio',
          channels: stream.channels,
          channelLayout: stream.channel_layout,
          sampleRate: stream.sample_rate ? parseInt(stream.sample_rate, 10) : undefined,
        };

      case 'subtitle':
        return {
          ...base,
          type: 'subtitle',
          forced: stream.disposition?.forced === 1,
          hearingImpaired: stream.disposition?.hearing_impaired === 1,
        };

      default:
        return {
          ...base,
          type: 'attachment',
        };
    }
  }

  /**
   * Parses frame rate string (e.g., "24000/1001") to number.
   */
  private parseFrameRate(frameRate?: string): number | undefined {
    if (!frameRate) return undefined;

    const parts = frameRate.split('/');
    const numerator = parts[0];
    const denominator = parts[1];
    if (parts.length === 2 && numerator && denominator) {
      const num = parseFloat(numerator);
      const den = parseFloat(denominator);
      if (den > 0) return num / den;
    }

    return parseFloat(frameRate) || undefined;
  }

  /**
   * Determines if a video stream is HDR.
   */
  private isHDR(stream: FFprobeStream): boolean {
    // Check color transfer characteristics
    const hdrTransfers = ['smpte2084', 'arib-std-b67', 'smpte428'];
    if (stream.color_transfer && hdrTransfers.includes(stream.color_transfer.toLowerCase())) {
      return true;
    }

    // Check color primaries
    if (stream.color_primaries === 'bt2020') {
      return true;
    }

    // Check pixel format for 10-bit
    if (stream.pix_fmt && stream.pix_fmt.includes('10')) {
      return true;
    }

    return false;
  }

  /**
   * Checks if FFprobe is available on the system.
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.ffprobePath, ['-version']);

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });
    });
  }
}

/**
 * Creates a new MediaProbe instance.
 */
export function createMediaProbe(ffprobePath?: string): MediaProbe {
  return new MediaProbe(ffprobePath);
}

