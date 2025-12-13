/**
 * TechnicalDetails component
 *
 * Displays technical information about a media file in a grid layout.
 * Matches the forreel design.
 */

import { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TechnicalDetailsProps {
  /** Video codec (e.g., "hevc", "h264") */
  videoCodec?: string | null;
  /** Audio codec (e.g., "truehd", "eac3") */
  audioCodec?: string | null;
  /** Resolution (e.g., "3840x2160") */
  resolution?: string | null;
  /** Runtime in minutes */
  runtime?: number | null;
  /** File duration in seconds */
  duration?: number | null;
  /** File size in bytes */
  fileSize?: number | null;
  /** Container format (e.g., "mkv") */
  container?: string | null;
  /** Bitrate in bits per second */
  bitRate?: number | null;
  /** Frame rate */
  frameRate?: number | null;
  /** HDR format */
  hdr?: string | null;
  /** Audio channels (e.g., "7.1", "5.1") */
  channels?: string | null;
  /** TMDb ID */
  tmdbId?: number | null;
  /** IMDb ID */
  imdbId?: string | null;
  /** File path */
  filePath?: string | null;
  /** File name */
  fileName?: string | null;
  /** Subtitle languages */
  subtitleLanguages?: string[];
  /** Is loading */
  isLoading?: boolean;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Format bitrate
 */
function formatBitRate(bps: number): string {
  if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(1)} Mbps`;
  }
  return `${(bps / 1000).toFixed(0)} Kbps`;
}

/**
 * Format duration
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

/**
 * Format frame rate
 */
function formatFrameRate(fps: number): string {
  if (Math.abs(fps - 23.976) < 0.01) return '23.976 fps';
  if (Math.abs(fps - 24) < 0.01) return '24 fps';
  if (Math.abs(fps - 25) < 0.01) return '25 fps';
  if (Math.abs(fps - 29.97) < 0.01) return '29.97 fps';
  if (Math.abs(fps - 30) < 0.01) return '30 fps';
  if (Math.abs(fps - 59.94) < 0.01) return '59.94 fps';
  if (Math.abs(fps - 60) < 0.01) return '60 fps';
  return `${fps.toFixed(3)} fps`;
}

/**
 * Format video codec for display
 */
function formatVideoCodec(codec?: string | null): string {
  if (!codec) return 'Unknown';
  const lower = codec.toLowerCase();
  const codecMap: Record<string, string> = {
    'h264': 'H.264 (AVC)',
    'avc': 'H.264 (AVC)',
    'h265': 'H.265 (HEVC)',
    'hevc': 'H.265 (HEVC)',
    'av1': 'AV1',
    'vp9': 'VP9',
    'mpeg4': 'MPEG-4',
    'mpeg2video': 'MPEG-2',
  };
  return codecMap[lower] ?? codec.toUpperCase();
}

/**
 * Format audio codec for display
 */
function formatAudioCodec(codec?: string | null): string {
  if (!codec) return 'Unknown';
  const lower = codec.toLowerCase();
  const codecMap: Record<string, string> = {
    'truehd': 'Dolby TrueHD',
    'dts-hd ma': 'DTS-HD MA',
    'dts': 'DTS',
    'ac3': 'Dolby Digital (AC3)',
    'eac3': 'Dolby Digital Plus (E-AC3)',
    'aac': 'AAC',
    'flac': 'FLAC',
    'opus': 'Opus',
    'pcm': 'PCM',
    'mp3': 'MP3',
  };
  return codecMap[lower] ?? codec.toUpperCase();
}

/**
 * Format resolution for display
 */
function formatResolution(resolution?: string | null): string {
  if (!resolution) return 'Unknown';

  const match = resolution.match(/(\d+)x(\d+)/);
  if (match && match[1] && match[2]) {
    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);

    let label = '';
    if (width >= 3840 || height >= 2160) label = '4K UHD';
    else if (width >= 2560 || height >= 1440) label = '1440p QHD';
    else if (width >= 1920 || height >= 1080) label = '1080p FHD';
    else if (width >= 1280 || height >= 720) label = '720p HD';
    else label = 'SD';

    return `${resolution} (${label})`;
  }

  return resolution;
}

/**
 * Format container for display
 */
function formatContainer(container?: string | null): string {
  if (!container) return 'Unknown';
  const lower = container.toLowerCase();
  const containerMap: Record<string, string> = {
    'mkv': 'Matroska',
    'mp4': 'MPEG-4',
    'avi': 'AVI',
    'mov': 'QuickTime',
    'webm': 'WebM',
    'ts': 'MPEG-TS',
    'm2ts': 'Blu-ray',
  };
  return containerMap[lower] ?? container.toUpperCase();
}

/**
 * Info item component
 */
function InfoItem({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const handlePress = () => {
    if (href) {
      Linking.openURL(href);
    }
  };

  return (
    <View style={{ minWidth: 120 }}>
      <Text style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
        {label}
      </Text>
      {href ? (
        <Pressable onPress={handlePress}>
          <Text style={{ fontSize: 14, color: '#10b981', fontWeight: '500' }}>
            {value}
          </Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '500' }}>
          {value}
        </Text>
      )}
    </View>
  );
}

/**
 * Loading skeleton
 */
function TechnicalDetailsSkeleton() {
  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 12 }}>
        Technical Details
      </Text>
      <View
        style={{
          backgroundColor: 'rgba(39, 39, 42, 0.5)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={{ minWidth: 100 }}>
              <View style={{ width: 50, height: 10, backgroundColor: '#3f3f46', borderRadius: 4, marginBottom: 4 }} />
              <View style={{ width: 80, height: 14, backgroundColor: '#3f3f46', borderRadius: 4 }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * TechnicalDetails component
 */
export function TechnicalDetails({
  videoCodec,
  audioCodec,
  resolution,
  duration,
  fileSize,
  container,
  bitRate,
  frameRate,
  hdr,
  channels,
  tmdbId,
  imdbId,
  filePath,
  fileName,
  subtitleLanguages,
  isLoading,
}: TechnicalDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return <TechnicalDetailsSkeleton />;
  }

  // Check if we have any data to display
  const hasAnyData = videoCodec || audioCodec || resolution || duration || fileSize || container || bitRate || frameRate || hdr || channels || tmdbId || imdbId || fileName;
  
  if (!hasAnyData) {
    return null;
  }

  const hasFilePath = !!filePath || !!fileName;

  return (
    <View>
      {/* Header with expand toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>
          Technical Details
        </Text>
        {hasFilePath && (
          <Pressable
            onPress={() => setIsExpanded(!isExpanded)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={{ fontSize: 14, color: '#a1a1aa' }}>
              {isExpanded ? 'Less' : 'More'}
            </Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#a1a1aa"
            />
          </Pressable>
        )}
      </View>

      <View
        style={{
          backgroundColor: 'rgba(39, 39, 42, 0.5)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        {/* Grid of info items - matching forreel layout */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, rowGap: 16 }}>
          {/* Row 1: Video info */}
          {videoCodec && (
            <InfoItem label="Video" value={formatVideoCodec(videoCodec)} />
          )}
          {resolution && (
            <InfoItem label="Resolution" value={formatResolution(resolution)} />
          )}
          {frameRate && (
            <InfoItem label="Frame Rate" value={formatFrameRate(frameRate)} />
          )}
          {hdr && (
            <InfoItem label="HDR" value={hdr} />
          )}
          {audioCodec && (
            <InfoItem label="Audio" value={formatAudioCodec(audioCodec)} />
          )}
          {channels && (
            <InfoItem label="Channels" value={channels} />
          )}
        </View>

        {/* Row 2: File info */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, rowGap: 16, marginTop: 16 }}>
          {container && (
            <InfoItem label="Container" value={formatContainer(container)} />
          )}
          {fileSize && fileSize > 0 && (
            <InfoItem label="Size" value={formatFileSize(fileSize)} />
          )}
          {duration && duration > 0 && (
            <InfoItem label="Duration" value={formatDuration(duration)} />
          )}
          {bitRate && bitRate > 0 && (
            <InfoItem label="Bitrate" value={formatBitRate(bitRate)} />
          )}
          {tmdbId && (
            <InfoItem
              label="TMDb"
              value={String(tmdbId)}
              href={`https://www.themoviedb.org/movie/${tmdbId}`}
            />
          )}
          {imdbId && (
            <InfoItem
              label="IMDb"
              value={imdbId}
              href={`https://www.imdb.com/title/${imdbId}`}
            />
          )}
        </View>

        {/* Subtitles row */}
        {subtitleLanguages && subtitleLanguages.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <InfoItem label="Subtitles" value={subtitleLanguages.join(', ')} />
          </View>
        )}

        {/* File path/name */}
        {(filePath || fileName) && (
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(63, 63, 70, 0.5)' }}>
            <Text style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              File
            </Text>
            <Text
              style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }}
              numberOfLines={isExpanded ? undefined : 1}
            >
              {isExpanded ? filePath : fileName}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default TechnicalDetails;
