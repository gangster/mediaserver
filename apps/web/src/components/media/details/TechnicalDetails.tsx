/**
 * TechnicalDetails component
 *
 * Displays technical information about a media file in a grid layout.
 * Shows video, audio, and subtitle streams with expandable detailed view.
 * Used for both movies and episodes.
 */

import { useState, useMemo } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================================================
// Types
// ============================================================================

/** Base media stream interface */
interface MediaStream {
  index: number;
  type: 'video' | 'audio' | 'subtitle' | 'attachment';
  codec: string;
  codecLongName?: string;
  language?: string;
  title?: string;
  isDefault?: boolean;
  // Video specific
  width?: number;
  height?: number;
  frameRate?: number;
  profile?: string;
  level?: number;
  pixelFormat?: string;
  colorSpace?: string;
  hdr?: boolean;
  // Audio specific
  channels?: number;
  channelLayout?: string;
  sampleRate?: number;
  bitRate?: number;
  // Subtitle specific
  forced?: boolean;
  hearingImpaired?: boolean;
}

/** Video stream with required properties */
interface VideoStream extends MediaStream {
  type: 'video';
  width?: number;
  height?: number;
  frameRate?: number;
  hdr?: boolean;
  profile?: string;
  pixelFormat?: string;
  colorSpace?: string;
  bitRate?: number;
}

/** Audio stream with required properties */
interface AudioStream extends MediaStream {
  type: 'audio';
  channels?: number;
  channelLayout?: string;
  sampleRate?: number;
  bitRate?: number;
}

/** Subtitle stream with required properties */
interface SubtitleStream extends MediaStream {
  type: 'subtitle';
  forced?: boolean;
  hearingImpaired?: boolean;
}

interface TechnicalDetailsProps {
  /** Video codec (fallback if no streams) */
  videoCodec?: string | null;
  /** Audio codec (fallback if no streams) */
  audioCodec?: string | null;
  /** Resolution string (fallback if no streams) */
  resolution?: string | null;
  /** File duration in seconds */
  duration?: number | null;
  /** File size in bytes */
  fileSize?: number | null;
  /** Container format (e.g., "mkv") */
  container?: string | null;
  /** Bitrate in bits per second */
  bitRate?: number | null;
  /** Frame rate (fallback if no streams) */
  frameRate?: number | null;
  /** HDR format */
  hdr?: string | null;
  /** Audio channels (fallback if no streams) */
  channels?: string | null;
  /** TMDb ID */
  tmdbId?: number | null;
  /** IMDb ID */
  imdbId?: string | null;
  /** File path */
  filePath?: string | null;
  /** File name */
  fileName?: string | null;
  /** Subtitle languages (fallback if no streams) */
  subtitleLanguages?: string[];
  /** Raw media streams from FFprobe */
  mediaStreams?: MediaStream[];
  /** Air date (for episodes) */
  airDate?: string | null;
  /** Media type - affects TMDb link */
  mediaType?: 'movie' | 'tv';
  /** Is loading */
  isLoading?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Format file size in human-readable format */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/** Format bitrate */
function formatBitRate(bps: number): string {
  if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(1)} Mbps`;
  }
  return `${(bps / 1000).toFixed(0)} Kbps`;
}

/** Format duration from seconds */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

/** Format frame rate */
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

/** Format sample rate */
function formatSampleRate(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)} kHz`;
  }
  return `${hz} Hz`;
}

/** Get resolution label */
function getResolutionLabel(width: number, height: number): string {
  if (width >= 3840 || height >= 2160) return '4K UHD';
  if (width >= 2560 || height >= 1440) return '1440p QHD';
  if (width >= 1920 || height >= 1080) return '1080p FHD';
  if (width >= 1280 || height >= 720) return '720p HD';
  if (width >= 854 || height >= 480) return '480p';
  return 'SD';
}


/** Get language name from code */
function getLanguageName(code?: string): string {
  if (!code) return 'Unknown';
  const languages: Record<string, string> = {
    eng: 'English', en: 'English',
    spa: 'Spanish', es: 'Spanish',
    fre: 'French', fra: 'French', fr: 'French',
    ger: 'German', deu: 'German', de: 'German',
    ita: 'Italian', it: 'Italian',
    por: 'Portuguese', pt: 'Portuguese',
    rus: 'Russian', ru: 'Russian',
    jpn: 'Japanese', ja: 'Japanese',
    kor: 'Korean', ko: 'Korean',
    chi: 'Chinese', zho: 'Chinese', zh: 'Chinese',
    ara: 'Arabic', ar: 'Arabic',
    hin: 'Hindi', hi: 'Hindi',
    dut: 'Dutch', nld: 'Dutch', nl: 'Dutch',
    pol: 'Polish', pl: 'Polish',
    tur: 'Turkish', tr: 'Turkish',
    und: 'Unknown',
  };
  return languages[code.toLowerCase()] ?? code.toUpperCase();
}

/** Format video codec for display */
function formatVideoCodec(codec?: string | null): string {
  if (!codec) return 'Unknown';
  const lower = codec.toLowerCase();
  const codecMap: Record<string, string> = {
    'h264': 'H.264', 'avc': 'H.264', 'avc1': 'H.264',
    'h265': 'H.265', 'hevc': 'H.265', 'hvc1': 'H.265',
    'av1': 'AV1',
    'vp9': 'VP9', 'vp8': 'VP8',
    'mpeg4': 'MPEG-4', 'mpeg2video': 'MPEG-2',
  };
  return codecMap[lower] ?? codec.toUpperCase();
}

/** Format audio codec for display */
function formatAudioCodec(codec?: string | null): string {
  if (!codec) return 'Unknown';
  const lower = codec.toLowerCase();
  const codecMap: Record<string, string> = {
    'truehd': 'TrueHD', 'mlp': 'TrueHD',
    'dts': 'DTS', 'dca': 'DTS',
    'dts-hd': 'DTS-HD', 'dtshd': 'DTS-HD',
    'ac3': 'AC3', 'eac3': 'E-AC3', 'ec3': 'E-AC3',
    'aac': 'AAC', 'flac': 'FLAC', 'opus': 'Opus',
    'pcm': 'PCM', 'mp3': 'MP3', 'vorbis': 'Vorbis',
  };
  return codecMap[lower] ?? codec.toUpperCase();
}

/** Format container for display */
function formatContainer(container?: string | null): string {
  if (!container) return 'Unknown';
  const lower = container.toLowerCase();
  const containerMap: Record<string, string> = {
    'mkv': 'Matroska', 'mp4': 'MPEG-4', 'avi': 'AVI',
    'mov': 'QuickTime', 'webm': 'WebM', 'ts': 'MPEG-TS',
    'm2ts': 'Blu-ray', 'wmv': 'WMV',
  };
  return containerMap[lower] ?? container.toUpperCase();
}

// ============================================================================
// Sub-components
// ============================================================================

/** Info item component */
function InfoItem({ label, value, href }: { label: string; value: string; href?: string }) {
  const handlePress = () => {
    if (href) {
      Linking.openURL(href);
    }
  };

  return (
    <View style={{ minWidth: 100 }}>
      <Text style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
        {label}
      </Text>
      {href ? (
        <Pressable onPress={handlePress}>
          <Text style={{ fontSize: 14, color: '#10b981', fontWeight: '500' }}>{value}</Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '500' }}>{value}</Text>
      )}
    </View>
  );
}

/** Stream badge */
function StreamBadge({ children, color = '#3f3f46' }: { children: string; color?: string }) {
  return (
    <View style={{ backgroundColor: color, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
      <Text style={{ fontSize: 10, fontWeight: '600', color: '#e4e4e7' }}>{children}</Text>
    </View>
  );
}

/** Video stream row */
function VideoStreamRow({ stream, index }: { stream: VideoStream; index: number }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8,
      borderBottomWidth: index > 0 ? 0 : 1, borderBottomColor: 'rgba(63, 63, 70, 0.3)',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="videocam" size={14} color="#818cf8" />
        <Text style={{ fontSize: 12, color: '#a1a1aa' }}>#{stream.index}</Text>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <StreamBadge color="#312e81">{formatVideoCodec(stream.codec)}</StreamBadge>
        {stream.width && stream.height && (
          <StreamBadge>{`${stream.width}×${stream.height}`}</StreamBadge>
        )}
        {stream.frameRate && <StreamBadge>{formatFrameRate(stream.frameRate)}</StreamBadge>}
        {stream.hdr && <StreamBadge color="#713f12">HDR</StreamBadge>}
        {stream.profile && <StreamBadge>{stream.profile}</StreamBadge>}
        {stream.bitRate && <StreamBadge>{formatBitRate(stream.bitRate)}</StreamBadge>}
      </View>
    </View>
  );
}

/** Audio stream row */
function AudioStreamRow({ stream, index }: { stream: AudioStream; index: number }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8,
      borderBottomWidth: index > 0 ? 0 : 1, borderBottomColor: 'rgba(63, 63, 70, 0.3)',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="musical-notes" size={14} color="#22c55e" />
        <Text style={{ fontSize: 12, color: '#a1a1aa' }}>#{stream.index}</Text>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <StreamBadge color="#14532d">{formatAudioCodec(stream.codec)}</StreamBadge>
        {stream.channelLayout && <StreamBadge>{stream.channelLayout}</StreamBadge>}
        {!stream.channelLayout && stream.channels && <StreamBadge>{`${stream.channels} ch`}</StreamBadge>}
        {stream.sampleRate && <StreamBadge>{formatSampleRate(stream.sampleRate)}</StreamBadge>}
        {stream.language && <StreamBadge>{getLanguageName(stream.language)}</StreamBadge>}
        {stream.bitRate && <StreamBadge>{formatBitRate(stream.bitRate)}</StreamBadge>}
        {stream.isDefault && <StreamBadge color="#0369a1">Default</StreamBadge>}
      </View>
    </View>
  );
}

/** Subtitle stream row */
function SubtitleStreamRow({ stream, index }: { stream: SubtitleStream; index: number }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8,
      borderBottomWidth: index > 0 ? 0 : 1, borderBottomColor: 'rgba(63, 63, 70, 0.3)',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="text" size={14} color="#f59e0b" />
        <Text style={{ fontSize: 12, color: '#a1a1aa' }}>#{stream.index}</Text>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <StreamBadge color="#78350f">{stream.codec?.toUpperCase() ?? 'SUB'}</StreamBadge>
        {stream.language && <StreamBadge>{getLanguageName(stream.language)}</StreamBadge>}
        {stream.title && <StreamBadge>{stream.title}</StreamBadge>}
        {stream.forced && <StreamBadge color="#7c2d12">Forced</StreamBadge>}
        {stream.hearingImpaired && <StreamBadge color="#0e7490">SDH</StreamBadge>}
        {stream.isDefault && <StreamBadge color="#0369a1">Default</StreamBadge>}
      </View>
    </View>
  );
}

/** Loading skeleton */
function TechnicalDetailsSkeleton() {
  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 12 }}>
        Technical Details
      </Text>
      <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 16 }}>
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

// ============================================================================
// Main Component
// ============================================================================

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
  mediaStreams,
  airDate,
  mediaType = 'movie',
  isLoading,
}: TechnicalDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse media streams
  const { videoStreams, audioStreams, subtitleStreams } = useMemo(() => {
    if (!mediaStreams) return { videoStreams: [], audioStreams: [], subtitleStreams: [] };
    return {
      videoStreams: mediaStreams.filter((s): s is VideoStream => s.type === 'video'),
      audioStreams: mediaStreams.filter((s): s is AudioStream => s.type === 'audio'),
      subtitleStreams: mediaStreams.filter((s): s is SubtitleStream => s.type === 'subtitle'),
    };
  }, [mediaStreams]);

  const hasDetailedStreams = videoStreams.length > 0 || audioStreams.length > 0;
  const video = videoStreams[0];
  const audio = audioStreams[0];

  // Derive container from file path if not provided
  const derivedContainer = container ?? filePath?.split('.').pop()?.toLowerCase() ?? null;
  const derivedFileName = fileName ?? filePath?.split('/').pop() ?? null;

  // Build subtitle summary from streams or fallback to subtitleLanguages prop
  const subtitleSummary = useMemo(() => {
    if (subtitleStreams.length > 0) {
      const langs = [...new Set(subtitleStreams.map((s) => getLanguageName(s.language)))];
      return langs.slice(0, 3).join(', ') + (langs.length > 3 ? ` +${langs.length - 3}` : '');
    }
    if (subtitleLanguages && subtitleLanguages.length > 0) {
      return subtitleLanguages.slice(0, 3).join(', ') + (subtitleLanguages.length > 3 ? ` +${subtitleLanguages.length - 3}` : '');
    }
    return null;
  }, [subtitleStreams, subtitleLanguages]);

  // Audio summary
  const audioSummary = useMemo(() => {
    if (audio) {
      const channelInfo = audio.channelLayout ?? (audio.channels ? `${audio.channels} ch` : null);
      if (audioStreams.length > 1) {
        return `${channelInfo} +${audioStreams.length - 1}`;
      }
      return channelInfo;
    }
    return channels;
  }, [audio, audioStreams, channels]);

  if (isLoading) {
    return <TechnicalDetailsSkeleton />;
  }

  // Check if we have any data to display
  const hasAnyData = hasDetailedStreams || videoCodec || audioCodec || resolution || duration || fileSize || derivedContainer || bitRate || frameRate || hdr || channels || tmdbId || imdbId || derivedFileName;

  if (!hasAnyData) {
    return null;
  }

  const hasExpandableContent = videoStreams.length > 0 || audioStreams.length > 1 || subtitleStreams.length > 0 || !!filePath;

  // TMDb link based on media type
  const tmdbHref = tmdbId
    ? `https://www.themoviedb.org/${mediaType}/${tmdbId}`
    : undefined;

  return (
    <View>
      {/* Header with expand toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>
          Technical Details
        </Text>
        {hasExpandableContent && (
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

      <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 12, padding: 16 }}>
        {/* Compact summary grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, rowGap: 16 }}>
          {/* Video info - prefer streams over fallback props */}
          {video ? (
            <>
              <InfoItem label="Video" value={formatVideoCodec(video.codec)} />
              {video.width && video.height && (
                <InfoItem label="Resolution" value={`${video.width}×${video.height} (${getResolutionLabel(video.width, video.height)})`} />
              )}
              {video.frameRate && <InfoItem label="Frame Rate" value={formatFrameRate(video.frameRate)} />}
              {video.hdr && <InfoItem label="HDR" value="HDR10" />}
            </>
          ) : (
            <>
              {videoCodec && <InfoItem label="Video" value={formatVideoCodec(videoCodec)} />}
              {resolution && <InfoItem label="Resolution" value={resolution} />}
              {frameRate && <InfoItem label="Frame Rate" value={formatFrameRate(frameRate)} />}
              {hdr && <InfoItem label="HDR" value={hdr} />}
            </>
          )}

          {/* Audio info */}
          {audio ? (
            <>
              <InfoItem label="Audio" value={formatAudioCodec(audio.codec)} />
              {audioSummary && <InfoItem label="Channels" value={audioSummary} />}
            </>
          ) : (
            <>
              {audioCodec && <InfoItem label="Audio" value={formatAudioCodec(audioCodec)} />}
              {channels && <InfoItem label="Channels" value={channels} />}
            </>
          )}

          {/* Subtitles */}
          {(subtitleStreams.length > 0 || (subtitleLanguages && subtitleLanguages.length > 0)) && subtitleSummary && (
            <InfoItem label="Subtitles" value={subtitleSummary} />
          )}
        </View>

        {/* Second row: File info */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, rowGap: 16, marginTop: 16 }}>
          {derivedContainer && <InfoItem label="Container" value={formatContainer(derivedContainer)} />}
          {fileSize && fileSize > 0 && <InfoItem label="Size" value={formatFileSize(fileSize)} />}
          {duration && duration > 0 && <InfoItem label="Duration" value={formatDuration(duration)} />}
          {bitRate && bitRate > 0 && <InfoItem label="Bitrate" value={formatBitRate(bitRate)} />}
          {airDate && (
            <InfoItem
              label="Air Date"
              value={new Date(airDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            />
          )}
          {tmdbId && <InfoItem label="TMDb" value={String(tmdbId)} href={tmdbHref} />}
          {imdbId && <InfoItem label="IMDb" value={imdbId} href={`https://www.imdb.com/title/${imdbId}`} />}
        </View>

        {/* Expanded details */}
        {isExpanded && hasExpandableContent && (
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(63, 63, 70, 0.5)' }}>
            {/* All video streams */}
            {videoStreams.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Video Streams ({videoStreams.length})
                </Text>
                {videoStreams.map((stream, i) => (
                  <VideoStreamRow key={stream.index} stream={stream} index={i} />
                ))}
              </View>
            )}

            {/* All audio streams */}
            {audioStreams.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Audio Streams ({audioStreams.length})
                </Text>
                {audioStreams.map((stream, i) => (
                  <AudioStreamRow key={stream.index} stream={stream} index={i} />
                ))}
              </View>
            )}

            {/* All subtitle streams */}
            {subtitleStreams.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Subtitle Streams ({subtitleStreams.length})
                </Text>
                {subtitleStreams.map((stream, i) => (
                  <SubtitleStreamRow key={stream.index} stream={stream} index={i} />
                ))}
              </View>
            )}

            {/* Full file path */}
            {filePath && (
              <View>
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  File Path
                </Text>
                <Text style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }}>{filePath}</Text>
              </View>
            )}
          </View>
        )}

        {/* File name (when collapsed) */}
        {!isExpanded && derivedFileName && (
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(63, 63, 70, 0.5)' }}>
            <Text style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              File
            </Text>
            <Text style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }} numberOfLines={1}>
              {derivedFileName}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default TechnicalDetails;
