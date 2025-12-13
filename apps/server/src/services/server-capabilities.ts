/**
 * Server Capability Detection Service
 *
 * Detects CPU, GPU, and system resources to classify the server
 * and determine transcoding capacity.
 *
 * @see docs/TRANSCODING_PIPELINE.md §2 for specification
 */

import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import type {
  ServerCapabilities,
  CPUInfo,
  GPUInfo,
  CPUVendor,
  GPUVendor,
  CPUArchitecture,
  ServerClass,
  FFmpegCapabilityManifest,
} from '@mediaserver/core';
import { generateFFmpegManifest, canTranscode } from './ffmpeg-capabilities.js';
import { logger } from '../lib/logger.js';

const exec = promisify(execCallback);

/** Command timeout (ms) */
const TIMEOUT = 5000;

/**
 * Detect CPU information.
 */
async function detectCPU(): Promise<CPUInfo> {
  const cpus = os.cpus();
  const model = cpus[0]?.model ?? 'Unknown';
  const cores = cpus.length;
  const threads = cores; // os.cpus() returns one entry per logical core

  // Detect vendor from model string
  let vendor: CPUVendor = 'unknown';
  const modelLower = model.toLowerCase();
  if (modelLower.includes('intel')) {
    vendor = 'intel';
  } else if (modelLower.includes('amd') || modelLower.includes('ryzen')) {
    vendor = 'amd';
  } else if (modelLower.includes('apple') || modelLower.includes('m1') || modelLower.includes('m2') || modelLower.includes('m3') || modelLower.includes('m4')) {
    vendor = 'apple';
  } else if (modelLower.includes('arm') || modelLower.includes('aarch')) {
    vendor = 'arm';
  }

  // Detect architecture
  const arch = os.arch();
  const architecture: CPUArchitecture = arch === 'arm64' ? 'arm64' : 'x64';

  // Simple benchmark score based on cores and rough speed estimate
  // This is a heuristic, not a real benchmark
  const speedMHz = cpus[0]?.speed ?? 2000;
  const benchmarkScore = Math.round((cores * speedMHz) / 100);

  return {
    model,
    vendor,
    cores,
    threads,
    architecture,
    benchmarkScore,
  };
}

/**
 * Detect GPU information.
 */
async function detectGPU(): Promise<GPUInfo> {
  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      // macOS - use system_profiler
      return await detectMacGPU();
    } else if (platform === 'linux') {
      // Linux - try nvidia-smi first, then lspci
      return await detectLinuxGPU();
    } else if (platform === 'win32') {
      // Windows - use wmic
      return await detectWindowsGPU();
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to detect GPU');
  }

  return {
    vendor: 'none',
    model: 'Unknown',
    vram: 0,
    driverVersion: 'unknown',
  };
}

/**
 * Detect GPU on macOS.
 */
async function detectMacGPU(): Promise<GPUInfo> {
  try {
    const { stdout } = await exec(
      'system_profiler SPDisplaysDataType -json',
      { timeout: TIMEOUT }
    );
    const data = JSON.parse(stdout);
    const displays = data.SPDisplaysDataType ?? [];

    for (const display of displays) {
      const model = display.sppci_model ?? display._name ?? 'Unknown';
      const vramStr = display.spdisplays_vram ?? display.sppci_vram ?? '0';
      const vram = parseInt(vramStr.replace(/\D/g, ''), 10) || 0;

      // Determine vendor
      let vendor: GPUVendor = 'none';
      const modelLower = model.toLowerCase();
      if (modelLower.includes('apple') || modelLower.includes('m1') || modelLower.includes('m2') || modelLower.includes('m3') || modelLower.includes('m4')) {
        vendor = 'apple';
      } else if (modelLower.includes('nvidia') || modelLower.includes('geforce') || modelLower.includes('quadro')) {
        vendor = 'nvidia';
      } else if (modelLower.includes('amd') || modelLower.includes('radeon')) {
        vendor = 'amd';
      } else if (modelLower.includes('intel')) {
        vendor = 'intel';
      }

      return {
        vendor,
        model,
        vram,
        driverVersion: 'macOS native',
      };
    }
  } catch {
    // Fall through to return default
  }

  return {
    vendor: 'apple',
    model: 'Apple Silicon',
    vram: 0,
    driverVersion: 'macOS native',
  };
}

/**
 * Detect GPU on Linux.
 */
async function detectLinuxGPU(): Promise<GPUInfo> {
  // Try NVIDIA first
  try {
    const { stdout } = await exec(
      'nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits',
      { timeout: TIMEOUT }
    );
    const [name, vramStr, driverVersion] = stdout.trim().split(',').map(s => s.trim());
    return {
      vendor: 'nvidia',
      model: name ?? 'NVIDIA GPU',
      vram: parseInt(vramStr ?? '0', 10),
      driverVersion: driverVersion ?? 'unknown',
    };
  } catch {
    // Not NVIDIA or nvidia-smi not available
  }

  // Try lspci for any GPU
  try {
    const { stdout } = await exec('lspci | grep -i vga', { timeout: TIMEOUT });
    const line = stdout.trim().split('\n')[0] ?? '';

    let vendor: GPUVendor = 'none';
    if (line.toLowerCase().includes('nvidia')) {
      vendor = 'nvidia';
    } else if (line.toLowerCase().includes('amd') || line.toLowerCase().includes('radeon')) {
      vendor = 'amd';
    } else if (line.toLowerCase().includes('intel')) {
      vendor = 'intel';
    }

    // Extract model name (after the colon)
    const model = line.split(':').slice(-1)[0]?.trim() ?? 'Unknown';

    return {
      vendor,
      model,
      vram: 0, // Can't easily get VRAM from lspci
      driverVersion: 'unknown',
    };
  } catch {
    // lspci not available
  }

  return {
    vendor: 'none',
    model: 'Unknown',
    vram: 0,
    driverVersion: 'unknown',
  };
}

/**
 * Detect GPU on Windows.
 */
async function detectWindowsGPU(): Promise<GPUInfo> {
  try {
    const { stdout } = await exec(
      'wmic path win32_videocontroller get name,adapterram,driverversion /format:csv',
      { timeout: TIMEOUT }
    );

    const lines = stdout.trim().split('\n').slice(1);
    for (const line of lines) {
      const [, adapterRam, driverVersion, name] = line.split(',');
      if (!name) continue;

      let vendor: GPUVendor = 'none';
      const nameLower = name.toLowerCase();
      if (nameLower.includes('nvidia') || nameLower.includes('geforce') || nameLower.includes('quadro')) {
        vendor = 'nvidia';
      } else if (nameLower.includes('amd') || nameLower.includes('radeon')) {
        vendor = 'amd';
      } else if (nameLower.includes('intel')) {
        vendor = 'intel';
      }

      const vram = Math.round(parseInt(adapterRam ?? '0', 10) / (1024 * 1024));

      return {
        vendor,
        model: name.trim(),
        vram,
        driverVersion: driverVersion?.trim() ?? 'unknown',
      };
    }
  } catch {
    // WMIC not available
  }

  return {
    vendor: 'none',
    model: 'Unknown',
    vram: 0,
    driverVersion: 'unknown',
  };
}

/**
 * Get available RAM in MB.
 */
function getRAMMB(): number {
  return Math.round(os.totalmem() / (1024 * 1024));
}

/**
 * Get available scratch disk space in GB.
 * Checks the temp directory or a specified transcode cache path.
 */
async function getScratchDiskSpaceGB(path?: string): Promise<number> {
  const checkPath = path ?? os.tmpdir();

  try {
    // Use df command to get disk space
    const { stdout } = await exec(`df -k "${checkPath}"`, { timeout: TIMEOUT });
    const lines = stdout.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1]?.split(/\s+/) ?? [];
      // Available space is typically the 4th column (index 3)
      const availableKB = parseInt(parts[3] ?? '0', 10);
      return Math.round(availableKB / (1024 * 1024));
    }
  } catch {
    // df not available or failed
  }

  // Fallback: return a default value
  return 50;
}

/**
 * Classify server based on capabilities.
 */
function classifyServer(
  cpu: CPUInfo,
  gpu: GPUInfo,
  manifest: FFmpegCapabilityManifest,
  ramMB: number
): { serverClass: ServerClass; maxConcurrentTranscodes: number; maxThumbnailJobs: number } {
  // Check for GPU transcoding capability
  const hasGPUTranscode =
    manifest.encoders.h264_nvenc ||
    manifest.encoders.h264_videotoolbox ||
    manifest.encoders.h264_qsv ||
    manifest.encoders.h264_amf;

  // Classify based on CPU, GPU, and RAM
  if (gpu.vendor === 'nvidia' && hasGPUTranscode && gpu.vram >= 4000) {
    // Enterprise: NVIDIA GPU with 4GB+ VRAM
    if (cpu.cores >= 8 && ramMB >= 32000) {
      return { serverClass: 'enterprise', maxConcurrentTranscodes: 10, maxThumbnailJobs: 4 };
    }
    // High: NVIDIA GPU
    return { serverClass: 'high', maxConcurrentTranscodes: 6, maxThumbnailJobs: 3 };
  }

  if (hasGPUTranscode) {
    // High: Any GPU transcoding (Intel iGPU, Apple Silicon, etc.)
    return { serverClass: 'high', maxConcurrentTranscodes: 4, maxThumbnailJobs: 2 };
  }

  // CPU-only classification
  if (cpu.cores >= 8 && ramMB >= 16000 && cpu.benchmarkScore >= 200) {
    // Medium: Strong CPU
    return { serverClass: 'medium', maxConcurrentTranscodes: 2, maxThumbnailJobs: 2 };
  }

  if (cpu.cores >= 4 && ramMB >= 4000) {
    // Low: Basic CPU
    return { serverClass: 'low', maxConcurrentTranscodes: 1, maxThumbnailJobs: 1 };
  }

  // Very low: Raspberry Pi, weak NAS
  // Can't transcode effectively
  return { serverClass: 'low', maxConcurrentTranscodes: 0, maxThumbnailJobs: 1 };
}

/**
 * Detect all server capabilities.
 *
 * This is the main entry point for capability detection.
 * Should be called at server startup.
 */
export async function detectServerCapabilities(): Promise<ServerCapabilities> {
  logger.info('Detecting server capabilities...');
  const startTime = Date.now();

  // Detect all components in parallel where possible
  const [cpu, gpu, ffmpegManifest, ramMB, scratchDiskSpaceGB] = await Promise.all([
    detectCPU(),
    detectGPU(),
    generateFFmpegManifest(),
    Promise.resolve(getRAMMB()),
    getScratchDiskSpaceGB(),
  ]);

  // Classify the server
  const { serverClass, maxConcurrentTranscodes, maxThumbnailJobs } = classifyServer(
    cpu,
    gpu,
    ffmpegManifest,
    ramMB
  );

  const capabilities: ServerCapabilities = {
    cpu,
    gpu,
    ffmpegManifest,
    serverClass,
    maxConcurrentTranscodes,
    maxConcurrentThumbnailJobs: maxThumbnailJobs,
    ramMB,
    scratchDiskSpaceGB,
    detectedAt: new Date().toISOString(),
  };

  const durationMs = Date.now() - startTime;
  logger.info(
    {
      durationMs,
      serverClass,
      cpu: `${cpu.vendor} ${cpu.model} (${cpu.cores} cores)`,
      gpu: `${gpu.vendor} ${gpu.model}`,
      maxConcurrentTranscodes,
      canTranscode: canTranscode(ffmpegManifest),
    },
    'Server capabilities detected'
  );

  return capabilities;
}

/**
 * Check if this server can perform any transcoding.
 */
export function serverCanTranscode(capabilities: ServerCapabilities): boolean {
  return (
    capabilities.maxConcurrentTranscodes > 0 &&
    canTranscode(capabilities.ffmpegManifest)
  );
}

/**
 * Get a human-readable summary of server capabilities.
 */
export function getCapabilitySummary(capabilities: ServerCapabilities): string {
  const lines = [
    `Server Class: ${capabilities.serverClass}`,
    `CPU: ${capabilities.cpu.vendor} ${capabilities.cpu.model}`,
    `  Cores: ${capabilities.cpu.cores}, Architecture: ${capabilities.cpu.architecture}`,
    `GPU: ${capabilities.gpu.vendor} ${capabilities.gpu.model}`,
    `  VRAM: ${capabilities.gpu.vram}MB`,
    `Memory: ${Math.round(capabilities.ramMB / 1024)}GB`,
    `Scratch Disk: ${capabilities.scratchDiskSpaceGB}GB`,
    `Max Concurrent Transcodes: ${capabilities.maxConcurrentTranscodes}`,
    `FFmpeg: ${capabilities.ffmpegManifest.ffmpegVersion}`,
    `Can Transcode: ${canTranscode(capabilities.ffmpegManifest) ? 'Yes' : 'No'}`,
  ];

  // Add hardware acceleration info
  const hwaccel = Object.entries(capabilities.ffmpegManifest.hwaccel)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (hwaccel.length > 0) {
    lines.push(`Hardware Acceleration: ${hwaccel.join(', ')}`);
  }

  return lines.join('\n');
}
