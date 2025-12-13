/**
 * Episode Detail Page
 *
 * Full detail page for a TV episode with hero image, metadata,
 * watch progress, episode navigation, and season episode strip.
 * Based on forreel design with metadata source selection.
 */

import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Image, Pressable, useWindowDimensions, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, Link, Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../src/components/layout';
import { useEpisode, type MetadataProvider } from '@mediaserver/api-client';
import { useAuth } from '../../../src/hooks/useAuth';
import { MetadataSourceSelector, RefreshMetadataButton, GuestStarsSection } from '../../../src/components/media';
import { getMediaImageUrl } from '../../../src/lib/config';
import { formatRuntime, formatDate, normalizeTitle } from '../../../src/lib/format';

/**
 * Rating badge (yellow like forreel)
 */
function Rating({ value }: { value: number }) {
  return (
    <View className="flex-row items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded">
      <Ionicons name="star" size={14} color="#facc15" />
      <Text className="font-semibold text-yellow-400">{value.toFixed(1)}</Text>
    </View>
  );
}

/**
 * Genre tag (rounded pill style)
 */
function GenreTag({ genre }: { genre: string }) {
  return (
    <View className="px-3 py-1 bg-zinc-800 rounded-full">
      <Text className="text-sm text-zinc-300">{genre}</Text>
    </View>
  );
}

/**
 * Episode navigation card
 */
function EpisodeNavCard({
  episode,
  direction,
}: {
  episode: {
    id: string;
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
    stillPath: string | null;
  };
  direction: 'prev' | 'next';
}) {
  const router = useRouter();
  const stillUrl = episode.stillPath ? getMediaImageUrl('episodes', episode.id, 'still', 'medium') : '';

  return (
    <Pressable
      onPress={() => router.push(`/tv/episode/${episode.id}` as Href)}
      className="flex-row items-center gap-3 p-3 bg-zinc-800/50 rounded-lg flex-1"
    >
      {direction === 'prev' && (
        <Ionicons name="chevron-back" size={20} color="#a1a1aa" />
      )}

      {/* Thumbnail */}
      <View className="w-24 aspect-video rounded overflow-hidden bg-zinc-700">
        {stillUrl ? (
          <Image source={{ uri: stillUrl }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-zinc-500 text-sm">E{episode.episodeNumber}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View className="flex-1 min-w-0">
        <Text className="text-xs text-zinc-500 mb-0.5">
          {direction === 'prev' ? 'Previous' : 'Next'}
        </Text>
        <Text className="text-sm text-zinc-400">Episode {episode.episodeNumber}</Text>
        <Text className="text-sm text-white" numberOfLines={1}>
          {normalizeTitle(episode.title) || `Episode ${episode.episodeNumber}`}
        </Text>
      </View>

      {direction === 'next' && (
        <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
      )}
    </Pressable>
  );
}

/**
 * Season episode strip item
 */
function EpisodeStripItem({
  episode,
  isCurrent,
}: {
  episode: {
    id: string;
    episodeNumber: number;
    title: string | null;
    stillPath: string | null;
    runtime: number | null;
    watchProgress: { percentage: number; isWatched: boolean } | null;
  };
  isCurrent: boolean;
}) {
  const router = useRouter();
  const stillUrl = episode.stillPath ? getMediaImageUrl('episodes', episode.id, 'still', 'medium') : '';
  const hasProgress = episode.watchProgress && episode.watchProgress.percentage > 0;
  const isWatched = episode.watchProgress?.isWatched;

  return (
    <Pressable
      onPress={() => router.push(`/tv/episode/${episode.id}` as Href)}
      style={{ width: 160 }}
    >
      {/* Thumbnail */}
      <View
        style={{
          aspectRatio: 16 / 9,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: '#27272a',
          borderWidth: isCurrent ? 2 : 0,
          borderColor: '#10b981',
        }}
      >
        {stillUrl ? (
          <Image source={{ uri: stillUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-lg text-zinc-600">{episode.episodeNumber}</Text>
          </View>
        )}

        {/* Progress bar */}
        {hasProgress && !isWatched && (
          <View className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <View
              style={{ height: '100%', width: `${episode.watchProgress!.percentage}%`, backgroundColor: '#10b981' }}
            />
          </View>
        )}

        {/* Watched checkmark */}
        {isWatched && (
          <View className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-600 items-center justify-center">
            <Ionicons name="checkmark" size={12} color="#ffffff" />
          </View>
        )}

        {/* Now viewing */}
        {isCurrent && (
          <View className="absolute inset-0 items-center justify-center bg-black/40 rounded-lg">
            <View className="px-3 py-1.5 bg-emerald-600 rounded">
              <Text className="text-xs font-semibold text-white">Now Viewing</Text>
            </View>
          </View>
        )}
      </View>

      {/* Info */}
      <View className="mt-3 space-y-0.5">
        <Text className="text-xs text-zinc-500">E{episode.episodeNumber}</Text>
        <Text
          className={`text-sm ${isCurrent ? 'text-emerald-400' : 'text-white'}`}
          numberOfLines={1}
        >
          {normalizeTitle(episode.title) || `Episode ${episode.episodeNumber}`}
        </Text>
        {episode.runtime && <Text className="text-xs text-zinc-500">{episode.runtime}m</Text>}
      </View>
    </Pressable>
  );
}

/**
 * Show context card
 */
function ShowContextCard({
  show,
}: {
  show: { id: string; title: string; posterPath: string | null; genres: string[] };
}) {
  const router = useRouter();
  const posterUrl = show.posterPath ? getMediaImageUrl('shows', show.id, 'poster', 'small') : '';

  return (
    <Pressable
      onPress={() => router.push(`/tv/${show.id}` as Href)}
      className="flex-row items-center gap-4 p-4 bg-zinc-800/50 rounded-lg"
    >
      {/* Poster */}
      <View className="w-16 aspect-[2/3] rounded overflow-hidden bg-zinc-700">
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-zinc-500 text-lg">{show.title[0]}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View className="flex-1 min-w-0">
        <Text className="text-xs text-zinc-500 mb-1">Part of</Text>
        <Text className="text-lg font-semibold text-emerald-400" numberOfLines={1}>
          {show.title}
        </Text>
        {show.genres.length > 0 && (
          <Text className="text-sm text-zinc-400" numberOfLines={1}>
            {show.genres.slice(0, 3).join(' • ')}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
    </Pressable>
  );
}

// ============================================================================
// TECHNICAL DETAILS - Exact replica of forreel's TechnicalDetails component
// ============================================================================

/** Video stream information */
interface VideoStream {
  index: number;
  type: 'video';
  codec: string;
  codecLongName?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  profile?: string;
  level?: number;
  pixelFormat?: string;
  colorSpace?: string;
  hdr?: boolean;
  isDefault?: boolean;
  language?: string;
  title?: string;
}

/** Audio stream information */
interface AudioStream {
  index: number;
  type: 'audio';
  codec: string;
  codecLongName?: string;
  channels?: number;
  channelLayout?: string;
  sampleRate?: number;
  isDefault?: boolean;
  language?: string;
  title?: string;
}

/** Subtitle stream information */
interface SubtitleStream {
  index: number;
  type: 'subtitle';
  codec: string;
  codecLongName?: string;
  forced?: boolean;
  hearingImpaired?: boolean;
  isDefault?: boolean;
  language?: string;
  title?: string;
}

type MediaStream = VideoStream | AudioStream | SubtitleStream | { type: 'attachment'; index: number; codec: string };


/** Format duration */
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
  if (Math.abs(fps - 50) < 0.01) return '50 fps';
  if (Math.abs(fps - 59.94) < 0.01) return '59.94 fps';
  if (Math.abs(fps - 60) < 0.01) return '60 fps';
  return `${fps.toFixed(2)} fps`;
}

/** Get language display name */
function getLanguageName(code?: string): string {
  if (!code) return 'Unknown';
  const languages: Record<string, string> = {
    eng: 'English',
    spa: 'Spanish',
    fra: 'French',
    deu: 'German',
    ita: 'Italian',
    por: 'Portuguese',
    rus: 'Russian',
    jpn: 'Japanese',
    kor: 'Korean',
    zho: 'Chinese',
    chi: 'Chinese',
    ara: 'Arabic',
    hin: 'Hindi',
    und: 'Undefined',
  };
  return languages[code.toLowerCase()] ?? code.toUpperCase();
}

/** Format sample rate */
function formatSampleRate(hz: number): string {
  return `${(hz / 1000).toFixed(1)} kHz`;
}

/** Get resolution label from dimensions */
function getResolutionLabel(_width?: number, height?: number): string {
  if (!height) return '';
  if (height >= 2160) return '4K';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  return 'SD';
}

/** Get aspect ratio from dimensions */
function getAspectRatio(width?: number, height?: number): string {
  if (!width || !height) return '';
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.1) return '16:9';
  if (Math.abs(ratio - 4 / 3) < 0.1) return '4:3';
  if (Math.abs(ratio - 21 / 9) < 0.1) return '21:9';
  if (Math.abs(ratio - 2.35) < 0.1) return '2.35:1';
  if (Math.abs(ratio - 2.39) < 0.1) return '2.39:1';
  if (Math.abs(ratio - 1.85) < 0.1) return '1.85:1';
  return `${ratio.toFixed(2)}:1`;
}

/** Info item component */
function InfoItem({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, color: '#71717a' }}>{label}</Text>
      {href ? (
        <Pressable onPress={() => Linking.openURL(href)}>
          <Text style={{ fontSize: 14, color: '#34d399' }}>{value}</Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 14, color: '#ffffff' }}>{value}</Text>
      )}
    </View>
  );
}

/** Stream badge component */
function StreamBadge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary';
}) {
  const colors = {
    default: { bg: '#3f3f46', text: '#e4e4e7' },
    primary: { bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399' },
    secondary: { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' },
  };
  const { bg, text } = colors[variant];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
      <Text style={{ fontSize: 12, fontWeight: '500', color: text }}>{children}</Text>
    </View>
  );
}

/** Video stream row */
function VideoStreamRow({ stream, index }: { stream: VideoStream; index: number }) {
  const resolution = stream.width && stream.height ? `${stream.width}×${stream.height}` : '';
  const resLabel = getResolutionLabel(stream.width, stream.height);
  const aspectRatio = getAspectRatio(stream.width, stream.height);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(63, 63, 70, 0.5)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: 100 }}>
        <Ionicons name="videocam" size={16} color="#34d399" />
        <Text style={{ fontSize: 14, color: '#a1a1aa' }}>Video {index + 1}</Text>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 14, color: '#ffffff' }}>{stream.codec}</Text>
        {resolution && <Text style={{ fontSize: 14, color: '#a1a1aa' }}>{resolution} ({resLabel})</Text>}
        {stream.frameRate && <Text style={{ fontSize: 14, color: '#a1a1aa' }}>{formatFrameRate(stream.frameRate)}</Text>}
        {aspectRatio && <Text style={{ fontSize: 14, color: '#a1a1aa' }}>{aspectRatio}</Text>}
        {stream.hdr && <StreamBadge variant="primary">HDR</StreamBadge>}
        {stream.pixelFormat && <Text style={{ fontSize: 12, color: '#71717a', fontFamily: 'monospace' }}>{stream.pixelFormat}</Text>}
      </View>
    </View>
  );
}

/** Audio stream row */
function AudioStreamRow({ stream, index }: { stream: AudioStream; index: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(63, 63, 70, 0.5)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: 100 }}>
        <Ionicons name="volume-high" size={16} color="#60a5fa" />
        <Text style={{ fontSize: 14, color: '#a1a1aa' }}>Audio {index + 1}</Text>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 14, color: '#ffffff' }}>{stream.codec}</Text>
        {stream.channelLayout && <Text style={{ fontSize: 14, color: '#a1a1aa' }}>{stream.channelLayout}</Text>}
        {stream.sampleRate && <Text style={{ fontSize: 14, color: '#a1a1aa' }}>{formatSampleRate(stream.sampleRate)}</Text>}
        {stream.language && <StreamBadge>{getLanguageName(stream.language)}</StreamBadge>}
        {stream.title && <Text style={{ fontSize: 12, color: '#71717a' }}>({stream.title})</Text>}
      </View>
    </View>
  );
}

/** Subtitle stream row */
function SubtitleStreamRow({ stream, index }: { stream: SubtitleStream; index: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(63, 63, 70, 0.5)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: 100 }}>
        <Ionicons name="chatbubble" size={16} color="#a1a1aa" />
        <Text style={{ fontSize: 14, color: '#a1a1aa' }}>Sub {index + 1}</Text>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 14, color: '#ffffff' }}>{getLanguageName(stream.language)}</Text>
        <Text style={{ fontSize: 14, color: '#a1a1aa' }}>{stream.codec}</Text>
        {stream.forced && <StreamBadge variant="secondary">Forced</StreamBadge>}
        {stream.title && <Text style={{ fontSize: 12, color: '#71717a' }}>({stream.title})</Text>}
      </View>
    </View>
  );
}

/**
 * Technical Details component - exact replica of forreel
 */
function TechnicalDetails({
  episode,
  isExpanded,
  onToggle,
}: {
  episode: {
    resolution?: string | null;
    videoCodec?: string | null;
    audioCodec?: string | null;
    duration?: number | null;
    filePath?: string | null;
    runtime?: number | null;
    airDate?: string | null;
    tmdbId?: number | null;
    subtitlePaths?: string[] | null;
    mediaStreams?: MediaStream[];
  };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const videoStreams = (episode.mediaStreams?.filter((s): s is VideoStream => s.type === 'video') || []);
  const audioStreams = (episode.mediaStreams?.filter((s): s is AudioStream => s.type === 'audio') || []);
  const subtitleStreams = (episode.mediaStreams?.filter((s): s is SubtitleStream => s.type === 'subtitle') || []);

  const video = videoStreams[0];
  const audio = audioStreams[0];

  // Build compact summary
  const subtitleLanguages = [...new Set(subtitleStreams.map((s) => getLanguageName(s.language)))].slice(0, 3);
  const audioSummary = audioStreams.length > 1
    ? `${audio?.channelLayout || `${audio?.channels} ch`} +${audioStreams.length - 1}`
    : audio?.channelLayout || (audio?.channels ? `${audio.channels} ch` : null);

  // Get container from file extension
  const container = episode.filePath?.split('.').pop()?.toUpperCase();
  const containerName = container === 'MKV' ? 'Matroska' : container === 'MP4' ? 'MPEG-4' : container === 'WEBM' ? 'WebM' : container;

  // Get filename
  const fileName = episode.filePath?.split('/').pop() || '';

  // Check if we have detailed stream info or need to fall back to basic info
  const hasDetailedInfo = videoStreams.length > 0 || audioStreams.length > 0;
  const hasExpandableContent = videoStreams.length > 0 || audioStreams.length > 1 || subtitleStreams.length > 0;

  // If we have detailed stream info, show the full view
  if (hasDetailedInfo) {
    return (
      <View>
        {/* Header with expand toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>Technical Details</Text>
          {hasExpandableContent && (
            <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14, color: '#a1a1aa' }}>{isExpanded ? 'Less' : 'More'}</Text>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#a1a1aa" />
            </Pressable>
          )}
        </View>

        <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 8, padding: 16 }}>
          {/* Compact summary grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {/* Video info */}
            {video && (
              <>
                <View style={{ width: '33.33%' }}><InfoItem label="Video" value={video.codec} /></View>
                {(video.width && video.height) && (
                  <View style={{ width: '33.33%' }}><InfoItem label="Resolution" value={`${video.width}×${video.height} (${getResolutionLabel(video.width, video.height)})`} /></View>
                )}
                {video.frameRate && <View style={{ width: '33.33%' }}><InfoItem label="Frame Rate" value={formatFrameRate(video.frameRate)} /></View>}
                {video.hdr && <View style={{ width: '33.33%' }}><InfoItem label="HDR" value="HDR10" /></View>}
              </>
            )}
            {/* Fallback video info if no streams */}
            {!video && episode.videoCodec && <View style={{ width: '33.33%' }}><InfoItem label="Video" value={episode.videoCodec.toUpperCase()} /></View>}
            {!video && episode.resolution && <View style={{ width: '33.33%' }}><InfoItem label="Resolution" value={episode.resolution} /></View>}

            {/* Audio info */}
            {audio && (
              <>
                <View style={{ width: '33.33%' }}><InfoItem label="Audio" value={audio.codec} /></View>
                {audioSummary && <View style={{ width: '33.33%' }}><InfoItem label="Channels" value={audioSummary} /></View>}
              </>
            )}
            {!audio && episode.audioCodec && <View style={{ width: '33.33%' }}><InfoItem label="Audio" value={episode.audioCodec.toUpperCase()} /></View>}

            {/* Subtitles */}
            {subtitleStreams.length > 0 && (
              <View style={{ width: '33.33%' }}>
                <InfoItem label="Subtitles" value={subtitleLanguages.length > 0 ? subtitleLanguages.join(', ') : `${subtitleStreams.length} tracks`} />
              </View>
            )}

            {/* File info */}
            {containerName && <View style={{ width: '33.33%' }}><InfoItem label="Container" value={containerName} /></View>}
            {episode.duration && episode.duration > 0 && <View style={{ width: '33.33%' }}><InfoItem label="Duration" value={formatDuration(episode.duration)} /></View>}
            
            {/* Air date */}
            {episode.airDate && (
              <View style={{ width: '33.33%' }}>
                <InfoItem label="Air Date" value={new Date(episode.airDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
              </View>
            )}
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
              {episode.filePath && (
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    File Path
                  </Text>
                  <Text style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }}>{episode.filePath}</Text>
                </View>
              )}
            </View>
          )}

          {/* File name (when collapsed) */}
          {!isExpanded && episode.filePath && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(63, 63, 70, 0.5)' }}>
              <Text style={{ fontSize: 12, color: '#71717a' }}>File</Text>
              <Text style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }} numberOfLines={1}>{fileName}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Fallback view when no detailed stream info
  const details: Array<{ label: string; value: string }> = [];
  if (episode.resolution) details.push({ label: 'Resolution', value: episode.resolution });
  if (episode.videoCodec) details.push({ label: 'Video', value: episode.videoCodec.toUpperCase() });
  if (episode.audioCodec) details.push({ label: 'Audio', value: episode.audioCodec.toUpperCase() });
  if (episode.runtime && episode.runtime > 0) {
    const hours = Math.floor(episode.runtime / 60);
    const mins = episode.runtime % 60;
    details.push({ label: 'Runtime', value: hours > 0 ? `${hours}h ${mins}m` : `${mins}m` });
  }
  if (episode.duration && episode.duration > 0) {
    details.push({ label: 'Duration', value: formatDuration(episode.duration) });
  }
  if (episode.airDate) {
    try {
      details.push({
        label: 'Air Date',
        value: new Date(episode.airDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      });
    } catch {
      details.push({ label: 'Air Date', value: episode.airDate });
    }
  }
  if (containerName) details.push({ label: 'Container', value: containerName });

  if (details.length === 0 && !episode.filePath) return null;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>Technical Details</Text>
        {episode.filePath && (
          <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 14, color: '#a1a1aa' }}>{isExpanded ? 'Less' : 'More'}</Text>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#a1a1aa" />
          </Pressable>
        )}
      </View>

      <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)', borderRadius: 8, padding: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {details.map((detail) => (
            <View key={detail.label} style={{ width: '33.33%' }}>
              <InfoItem label={detail.label} value={detail.value} />
            </View>
          ))}
        </View>

        {/* File path */}
        {episode.filePath && (
          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(63, 63, 70, 0.5)' }}>
            <Text style={{ fontSize: 12, color: '#71717a' }}>File</Text>
            <Text style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }} numberOfLines={isExpanded ? undefined : 1}>
              {isExpanded ? episode.filePath : fileName}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Loading skeleton
 */
function EpisodeDetailSkeleton() {
  const { height } = useWindowDimensions();
  return (
    <Layout>
      <View className="flex-1 bg-zinc-900">
        <View style={{ height: height * 0.5, backgroundColor: '#27272a' }} />
        <View className="px-8 -mt-48">
          <View className="flex-row gap-8">
            <View className="w-80 aspect-video bg-zinc-800 rounded-lg" />
            <View className="flex-1 gap-4">
              <View className="w-1/3 h-4 bg-zinc-800 rounded" />
              <View className="w-2/3 h-12 bg-zinc-800 rounded" />
              <View className="w-1/4 h-6 bg-zinc-800 rounded" />
            </View>
          </View>
        </View>
      </View>
    </Layout>
  );
}

/**
 * Error state
 */
function EpisodeDetailError({ message, showId }: { message: string; showId?: string }) {
  const router = useRouter();
  return (
    <Layout>
      <View className="flex-1 bg-zinc-900 items-center justify-center p-8">
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text className="text-xl font-semibold text-white mt-4 mb-2">Episode Not Found</Text>
        <Text className="text-zinc-400 mb-6 text-center">{message}</Text>
        <Pressable
          onPress={() => (showId ? router.push(`/tv/${showId}` as Href) : router.push('/tv'))}
          className="px-6 py-3 bg-emerald-600 rounded-lg"
        >
          <Text className="text-white font-semibold">{showId ? 'Back to Show' : 'Back to TV Shows'}</Text>
        </Pressable>
      </View>
    </Layout>
  );
}

/**
 * Episode Detail Page
 */
export default function EpisodeDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activeProvider, setActiveProvider] = useState<MetadataProvider>('tmdb');
  const [techDetailsExpanded, setTechDetailsExpanded] = useState(false);

  const { data: episode, isLoading, error } = useEpisode(id ?? '', !!id);

  const handleProviderChange = useCallback((provider: MetadataProvider) => {
    setActiveProvider(provider);
  }, []);

  if (isLoading) return <EpisodeDetailSkeleton />;
  if (error || !episode) return <EpisodeDetailError message={error?.message ?? 'Episode not found'} />;

  const backdropUrl = episode.show?.backdropPath
    ? getMediaImageUrl('shows', episode.show.id, 'backdrop', 'large')
    : '';
  const stillUrl = episode.stillPath
    ? getMediaImageUrl('episodes', episode.id, 'still', 'large')
    : '';

  const hasProgress = episode.watchProgress && episode.watchProgress.percentage > 0;
  const isWatched = episode.watchProgress?.isWatched;

  // Episode title always comes from the episode record, NOT provider metadata
  // (provider metadata is for the show, not individual episodes)
  const displayTitle = normalizeTitle(episode.title) || `Episode ${episode.episodeNumber}`;
  // Overview can come from episode or be empty
  const displayOverview = episode.overview;

  return (
    <Layout>
      <ScrollView style={{ flex: 1, backgroundColor: '#18181b' }}>
        {/* Hero backdrop - 60vh like forreel */}
        <View style={{ height: height * 0.6, minHeight: 400 }}>
          {backdropUrl ? (
            <Image
              source={{ uri: backdropUrl }}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: '#27272a' }} />
          )}

          {/* Gradients */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              top: 0,
              // @ts-ignore
              background: 'linear-gradient(to top, #18181b 0%, rgba(24,24,27,0.6) 50%, transparent 100%)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              top: 0,
              // @ts-ignore
              background: 'linear-gradient(to right, rgba(24,24,27,0.8) 0%, transparent 50%)',
            }}
          />

          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            style={{
              position: 'absolute',
              top: 24,
              left: 24,
              padding: 8,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>
        </View>

        {/* Content - pulls up into hero like forreel */}
        <View style={{ marginTop: -192, paddingHorizontal: isDesktop ? 32 : 16, paddingBottom: 48 }}>
          <View style={{ maxWidth: 1152, alignSelf: 'center', width: '100%' }}>
            {/* Main layout - side by side on desktop */}
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 32 }}>
              {/* Episode still - w-80 like forreel */}
              <View style={{ width: isDesktop ? 320 : '100%' }}>
                {stillUrl ? (
                  <Image
                    source={{ uri: stillUrl }}
                    style={{
                      width: '100%',
                      aspectRatio: 16 / 9,
                      borderRadius: 8,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: '100%',
                      aspectRatio: 16 / 9,
                      backgroundColor: '#27272a',
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 36, color: '#52525b' }}>E{episode.episodeNumber}</Text>
                  </View>
                )}
              </View>

              {/* Info section */}
              <View style={{ flex: 1, gap: 24 }}>
                {/* Breadcrumb */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Link href={`/tv/${episode.show?.id}` as Href} asChild>
                    <Pressable>
                      <Text style={{ fontSize: 14, color: '#a1a1aa' }}>{episode.show?.title}</Text>
                    </Pressable>
                  </Link>
                  <Text style={{ color: '#52525b' }}>›</Text>
                  <Text style={{ fontSize: 14, color: '#a1a1aa' }}>
                    {episode.season?.name || `Season ${episode.seasonNumber}`}
                  </Text>
                  <Text style={{ color: '#52525b' }}>›</Text>
                  <Text style={{ fontSize: 14, color: '#10b981' }}>Episode {episode.episodeNumber}</Text>
                </View>

                {/* Episode Title - THIS IS THE EPISODE TITLE, NOT SHOW TITLE */}
                <Text style={{ fontSize: isDesktop ? 40 : 32, fontWeight: 'bold', color: '#ffffff' }}>
                  {displayTitle}
                </Text>

                {/* Stats row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                  {episode.voteAverage != null && episode.voteAverage > 0 && (
                    <Rating value={episode.voteAverage} />
                  )}
                  {episode.runtime && (
                    <>
                      <Text style={{ color: '#52525b' }}>•</Text>
                      <Text style={{ color: '#d4d4d8' }}>{formatRuntime(episode.runtime)}</Text>
                    </>
                  )}
                  {episode.airDate && (
                    <>
                      <Text style={{ color: '#52525b' }}>•</Text>
                      <Text style={{ color: '#d4d4d8' }}>{formatDate(episode.airDate)}</Text>
                    </>
                  )}
                </View>

                {/* Progress indicator */}
                {hasProgress && !isWatched && (
                  <View style={{ maxWidth: 320 }}>
                    <View style={{ height: 4, backgroundColor: '#3f3f46', borderRadius: 2, overflow: 'hidden' }}>
                      <View
                        style={{
                          height: '100%',
                          width: `${episode.watchProgress!.percentage}%`,
                          backgroundColor: '#10b981',
                        }}
                      />
                    </View>
                    <Text style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>
                      {Math.round(episode.watchProgress!.percentage)}% complete
                    </Text>
                  </View>
                )}

                {/* Watched badge */}
                {isWatched && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 16,
                      backgroundColor: 'rgba(16,185,129,0.15)',
                      borderWidth: 1,
                      borderColor: 'rgba(16,185,129,0.3)',
                      borderRadius: 8,
                      maxWidth: 320,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#10b981',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="checkmark" size={20} color="#ffffff" />
                    </View>
                    <Text style={{ color: '#10b981' }}>Watched</Text>
                  </View>
                )}

                {/* Action buttons - white Play, gray Refresh Metadata */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                  <Link href={`/watch/episode/${episode.id}` as Href} asChild>
                    <Pressable
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 32,
                        paddingVertical: 16,
                        backgroundColor: '#ffffff',
                        borderRadius: 8,
                      }}
                    >
                      <Ionicons name="play" size={24} color="#000000" />
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#000000' }}>
                        {hasProgress && !isWatched ? 'Resume' : 'Play'}
                      </Text>
                    </Pressable>
                  </Link>

                  {hasProgress && !isWatched && (
                    <Link href={`/watch/episode/${episode.id}?start=0` as Href} asChild>
                      <Pressable
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          paddingHorizontal: 24,
                          paddingVertical: 16,
                          backgroundColor: '#27272a',
                          borderRadius: 8,
                        }}
                      >
                        <Ionicons name="refresh" size={20} color="#ffffff" />
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>Start Over</Text>
                      </Pressable>
                    </Link>
                  )}

                  {isAdmin && episode.show && (
                    <RefreshMetadataButton type="tvshow" itemId={episode.show.id} />
                  )}
                </View>

                {/* Genre tags */}
                {episode.show?.genres && episode.show.genres.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {episode.show.genres.map((genre: string) => (
                      <GenreTag key={genre} genre={genre} />
                    ))}
                  </View>
                )}

                {/* Overview */}
                {displayOverview && (
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 8 }}>
                      Overview
                    </Text>
                    <Text style={{ fontSize: 15, color: '#d4d4d8', lineHeight: 24 }}>{displayOverview}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Episode Navigation */}
            {(episode.previousEpisode || episode.nextEpisode) && (
              <View style={{ marginTop: 48 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 16 }}>
                  Episode Navigation
                </Text>
                <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 16 }}>
                  {episode.previousEpisode && (
                    <EpisodeNavCard episode={episode.previousEpisode} direction="prev" />
                  )}
                  {episode.nextEpisode && (
                    <EpisodeNavCard episode={episode.nextEpisode} direction="next" />
                  )}
                </View>
              </View>
            )}

            {/* Season Episodes */}
            {episode.seasonEpisodes && episode.seasonEpisodes.length > 1 && (
              <View style={{ marginTop: 48 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 16 }}>
                  {episode.season?.name || `Season ${episode.seasonNumber}`} Episodes
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 16, paddingVertical: 4 }}
                >
                  {episode.seasonEpisodes.map(
                    (ep: {
                      id: string;
                      episodeNumber: number;
                      title: string | null;
                      stillPath: string | null;
                      runtime: number | null;
                      watchProgress: { percentage: number; isWatched: boolean } | null;
                    }) => (
                      <EpisodeStripItem key={ep.id} episode={ep} isCurrent={ep.id === episode.id} />
                    )
                  )}
                </ScrollView>
              </View>
            )}

            {/* Show Context Card */}
            {episode.show && (
              <View style={{ marginTop: 48 }}>
                <ShowContextCard show={episode.show} />
              </View>
            )}

            {/* Guest Stars */}
            {episode.guestStars && episode.guestStars.length > 0 && (
              <GuestStarsSection
                guestStars={episode.guestStars.map((g: { id: string; name: string; character?: string; profilePath?: string | null; order?: number }) => ({
                  id: g.id,
                  name: g.name,
                  character: g.character,
                  profilePath: g.profilePath,
                  order: g.order,
                }))}
              />
            )}

            {/* Technical Details */}
            <View style={{ marginTop: 48 }}>
              <TechnicalDetails
                episode={episode}
                isExpanded={techDetailsExpanded}
                onToggle={() => setTechDetailsExpanded(!techDetailsExpanded)}
              />
            </View>

            {/* Metadata Source Selector - our addition */}
            <View style={{ marginTop: 48 }}>
              <MetadataSourceSelector
                type="show"
                itemId={episode.showId}
                currentProvider={activeProvider}
                onProviderChange={handleProviderChange}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </Layout>
  );
}
