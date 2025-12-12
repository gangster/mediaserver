/**
 * Library scanner implementation.
 *
 * Scans directories for media files, parses filenames, probes media info,
 * and emits progress events.
 */

import { readdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { parseMovieFilename, parseTVFilename, isTVEpisode } from './parsers.js';
import { MediaProbe } from './probe.js';
import type { ScanOptions, ScanProgress, ScanResult, ProbeResult } from './types.js';

/** Supported video extensions */
const VIDEO_EXTENSIONS = new Set([
  '.mkv', '.mp4', '.m4v', '.avi', '.mov', '.wmv', '.ts', '.m2ts', '.webm', '.flv', '.ogv',
]);

/** Default ignore patterns */
const DEFAULT_IGNORE_PATTERNS = [
  'sample',
  'trailer',
  'featurette',
  'extra',
  'bonus',
  'behind the scenes',
  'deleted scene',
  '.ds_store',
  'thumbs.db',
  '@eadir',
  '.recycle',
];

/**
 * Library scanner.
 *
 * Scans directories for media files, parses filenames, and probes media info.
 */
export class LibraryScanner {
  private options: ScanOptions;
  private probe: MediaProbe;
  private onProgress?: (progress: ScanProgress) => void;
  private cancelled = false;
  private results: ScanResult[] = [];
  private errors: string[] = [];
  private scannedCount = 0;
  private totalFiles = 0;

  constructor(options: ScanOptions, onProgress?: (progress: ScanProgress) => void) {
    this.options = {
      ...options,
      ignorePatterns: options.ignorePatterns ?? DEFAULT_IGNORE_PATTERNS,
    };
    this.onProgress = onProgress;
    this.probe = new MediaProbe();
  }

  /**
   * Starts the scan process.
   */
  async scan(): Promise<ScanResult[]> {
    this.cancelled = false;
    this.results = [];
    this.errors = [];
    this.scannedCount = 0;
    this.totalFiles = 0;

    try {
      // Phase 1: Discover all files
      this.emitProgress({
        libraryId: this.options.libraryId,
        status: 'scanning',
        progress: 0,
        itemsScanned: 0,
        itemsTotal: 0,
        newItems: 0,
        updatedItems: 0,
        removedItems: 0,
        errors: 0,
      });

      const files: string[] = [];
      for (const rootPath of this.options.paths) {
        if (this.cancelled) break;
        await this.discoverFiles(rootPath, files);
      }

      this.totalFiles = files.length;

      // Phase 2: Process files
      this.emitProgress({
        libraryId: this.options.libraryId,
        status: 'matching',
        progress: 5,
        itemsScanned: 0,
        itemsTotal: this.totalFiles,
        newItems: 0,
        updatedItems: 0,
        removedItems: 0,
        errors: 0,
      });

      for (const filePath of files) {
        if (this.cancelled) break;
        await this.processFile(filePath);
      }

      // Complete
      this.emitProgress({
        libraryId: this.options.libraryId,
        status: 'complete',
        progress: 100,
        itemsScanned: this.scannedCount,
        itemsTotal: this.totalFiles,
        newItems: this.results.length,
        updatedItems: 0, // Would need DB comparison for this
        removedItems: 0, // Would need DB comparison for this
        errors: this.errors.length,
      });

      return this.results;
    } catch (error) {
      this.emitProgress({
        libraryId: this.options.libraryId,
        status: 'error',
        progress: 0,
        itemsScanned: this.scannedCount,
        itemsTotal: this.totalFiles,
        newItems: 0,
        updatedItems: 0,
        removedItems: 0,
        errors: 1,
      });
      throw error;
    }
  }

  /**
   * Cancels the current scan.
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Recursively discovers video files in a directory.
   */
  private async discoverFiles(dirPath: string, files: string[]): Promise<void> {
    if (this.cancelled) return;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (this.cancelled) return;

        const fullPath = join(dirPath, entry.name);
        const lowerName = entry.name.toLowerCase();

        // Check ignore patterns
        if (this.shouldIgnore(lowerName)) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.discoverFiles(fullPath, files);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (VIDEO_EXTENSIONS.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Log but don't fail - some directories may be inaccessible
      this.errors.push(`Failed to read directory ${dirPath}: ${error}`);
    }
  }

  /**
   * Checks if a filename should be ignored.
   */
  private shouldIgnore(filename: string): boolean {
    const lower = filename.toLowerCase();
    const patterns = this.options.ignorePatterns ?? DEFAULT_IGNORE_PATTERNS;

    for (const pattern of patterns) {
      if (lower.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // Ignore hidden files
    if (filename.startsWith('.')) {
      return true;
    }

    return false;
  }

  /**
   * Processes a single media file.
   */
  private async processFile(filePath: string): Promise<void> {
    const filename = basename(filePath);

    this.scannedCount++;
    this.emitProgress({
      libraryId: this.options.libraryId,
      status: 'matching',
      progress: Math.min(95, 5 + Math.round((this.scannedCount / this.totalFiles) * 90)),
      currentFile: filename,
      itemsScanned: this.scannedCount,
      itemsTotal: this.totalFiles,
      newItems: this.results.length,
      updatedItems: 0,
      removedItems: 0,
      errors: this.errors.length,
    });

    try {
      // Determine media type
      const isEpisode = this.options.type === 'tv' || 
        (this.options.type === 'movie' ? false : isTVEpisode(filename));

      // Parse filename
      const parsed = isEpisode
        ? parseTVFilename(filename)
        : parseMovieFilename(filename);

      // Probe file for technical info
      let probe: ProbeResult | undefined;
      try {
        probe = await this.probe.probe(filePath);
      } catch (probeError) {
        // File may be corrupted or FFprobe not available
        this.errors.push(`Failed to probe ${filename}: ${probeError}`);
      }

      const result: ScanResult = {
        path: filePath,
        type: isEpisode ? 'episode' : 'movie',
        parsed,
        probe,
      };

      this.results.push(result);
    } catch (error) {
      this.errors.push(`Failed to process ${filename}: ${error}`);
      this.results.push({
        path: filePath,
        type: this.options.type === 'tv' ? 'episode' : 'movie',
        parsed: this.options.type === 'tv'
          ? { showTitle: filename, seasonNumber: 0, episodeNumber: 0 }
          : { title: filename },
        error: String(error),
      });
    }
  }

  /**
   * Emits a progress event.
   */
  private emitProgress(progress: ScanProgress): void {
    this.onProgress?.(progress);
  }

  /**
   * Gets the list of errors encountered during scanning.
   */
  getErrors(): string[] {
    return [...this.errors];
  }
}

/**
 * Creates a new LibraryScanner instance.
 */
export function createScanner(
  options: ScanOptions,
  onProgress?: (progress: ScanProgress) => void,
): LibraryScanner {
  return new LibraryScanner(options, onProgress);
}

/**
 * Scans a library and returns results.
 * Convenience function for one-off scans.
 */
export async function scanLibrary(
  libraryId: string,
  paths: string[],
  type: 'movie' | 'tv',
  onProgress?: (progress: ScanProgress) => void,
): Promise<ScanResult[]> {
  const scanner = createScanner({ libraryId, paths, type }, onProgress);
  return scanner.scan();
}
