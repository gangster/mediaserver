/**
 * HLS Playlist Generator
 *
 * Generates HLS master and media playlists according to HLS spec.
 * Handles epoch transitions with discontinuity markers.
 *
 * @see docs/TRANSCODING_PIPELINE.md §8 for specification
 */

import type {
  HLSMasterPlaylist,
  HLSMediaPlaylist,
  HLSSegment,
  HLSVariant,
  HLSAudioRendition,
  PlaybackPlan,
} from '@mediaserver/core';

/** HLS version we're generating */
const HLS_VERSION = 6;

/** MIME types for HLS */
export const HLS_MIME_TYPES = {
  playlist: 'application/vnd.apple.mpegurl',
  segment_ts: 'video/MP2T',
  segment_fmp4: 'video/mp4',
  init_segment: 'video/mp4',
} as const;

/**
 * Generate an HLS master playlist.
 */
export function generateMasterPlaylist(master: HLSMasterPlaylist): string {
  const lines: string[] = [];

  // Header
  lines.push('#EXTM3U');
  lines.push(`#EXT-X-VERSION:${HLS_VERSION}`);
  lines.push('#EXT-X-INDEPENDENT-SEGMENTS');
  lines.push('');

  // Audio renditions (if multiple audio tracks)
  if (master.audioRenditions.length > 0) {
    for (const audio of master.audioRenditions) {
      lines.push(formatAudioRendition(audio));
    }
    lines.push('');
  }

  // Variant streams
  for (const variant of master.variants) {
    lines.push(formatVariant(variant));
    lines.push(variant.uri);
  }

  return lines.join('\n') + '\n';
}

/**
 * Generate an HLS media playlist.
 */
export function generateMediaPlaylist(playlist: HLSMediaPlaylist): string {
  const lines: string[] = [];

  // Header
  lines.push('#EXTM3U');
  lines.push(`#EXT-X-VERSION:${HLS_VERSION}`);
  lines.push(`#EXT-X-TARGETDURATION:${Math.ceil(playlist.targetDuration)}`);
  lines.push(`#EXT-X-MEDIA-SEQUENCE:${playlist.mediaSequence}`);

  // Discontinuity sequence (for epoch handling)
  if (playlist.discontinuitySequence > 0) {
    lines.push(`#EXT-X-DISCONTINUITY-SEQUENCE:${playlist.discontinuitySequence}`);
  }

  // Playlist type
  lines.push(`#EXT-X-PLAYLIST-TYPE:${playlist.playlistType}`);
  lines.push('');

  // Segments
  let isFirstSegment = true;
  let lastEpoch = -1;

  for (const segment of playlist.segments) {
    // Discontinuity marker for epoch transitions
    if (segment.discontinuity || (segment.epochIndex !== lastEpoch && !isFirstSegment)) {
      lines.push('#EXT-X-DISCONTINUITY');
    }
    lastEpoch = segment.epochIndex;
    isFirstSegment = false;

    // Segment info
    lines.push(`#EXTINF:${segment.duration.toFixed(6)},`);
    lines.push(segment.filename);
  }

  // End marker
  if (playlist.endList) {
    lines.push('#EXT-X-ENDLIST');
  }

  return lines.join('\n') + '\n';
}

/**
 * Generate an HLS media playlist with byte ranges (for single-file HLS).
 */
export function generateByteRangePlaylist(
  playlist: HLSMediaPlaylist,
  segments: Array<HLSSegment & { byteOffset: number; byteLength: number }>
): string {
  const lines: string[] = [];

  lines.push('#EXTM3U');
  lines.push(`#EXT-X-VERSION:${HLS_VERSION}`);
  lines.push(`#EXT-X-TARGETDURATION:${Math.ceil(playlist.targetDuration)}`);
  lines.push(`#EXT-X-MEDIA-SEQUENCE:${playlist.mediaSequence}`);
  lines.push(`#EXT-X-PLAYLIST-TYPE:${playlist.playlistType}`);
  lines.push('');

  for (const segment of segments) {
    lines.push(`#EXTINF:${segment.duration.toFixed(6)},`);
    lines.push(`#EXT-X-BYTERANGE:${segment.byteLength}@${segment.byteOffset}`);
    lines.push(segment.filename);
  }

  if (playlist.endList) {
    lines.push('#EXT-X-ENDLIST');
  }

  return lines.join('\n') + '\n';
}

/**
 * Generate an fMP4 initialization segment playlist entry.
 */
export function generateFMP4InitPlaylist(
  playlist: HLSMediaPlaylist,
  initSegmentUri: string
): string {
  const lines: string[] = [];

  lines.push('#EXTM3U');
  lines.push(`#EXT-X-VERSION:${HLS_VERSION}`);
  lines.push(`#EXT-X-TARGETDURATION:${Math.ceil(playlist.targetDuration)}`);
  lines.push(`#EXT-X-MEDIA-SEQUENCE:${playlist.mediaSequence}`);
  lines.push(`#EXT-X-PLAYLIST-TYPE:${playlist.playlistType}`);
  lines.push('');

  // Map tag for fMP4 init segment
  lines.push(`#EXT-X-MAP:URI="${initSegmentUri}"`);
  lines.push('');

  // Segments
  for (const segment of playlist.segments) {
    if (segment.discontinuity) {
      lines.push('#EXT-X-DISCONTINUITY');
      // Re-specify map after discontinuity
      lines.push(`#EXT-X-MAP:URI="${initSegmentUri}"`);
    }
    lines.push(`#EXTINF:${segment.duration.toFixed(6)},`);
    lines.push(segment.filename);
  }

  if (playlist.endList) {
    lines.push('#EXT-X-ENDLIST');
  }

  return lines.join('\n') + '\n';
}

/**
 * Format an audio rendition line.
 */
function formatAudioRendition(audio: HLSAudioRendition): string {
  const attrs: string[] = [
    `TYPE=AUDIO`,
    `GROUP-ID="${audio.groupId}"`,
    `NAME="${audio.name}"`,
    `LANGUAGE="${audio.language}"`,
    `DEFAULT=${audio.isDefault ? 'YES' : 'NO'}`,
    `AUTOSELECT=${audio.autoSelect ? 'YES' : 'NO'}`,
    `CHANNELS="${audio.channels}"`,
  ];

  if (audio.uri) {
    attrs.push(`URI="${audio.uri}"`);
  }

  return `#EXT-X-MEDIA:${attrs.join(',')}`;
}

/**
 * Format a variant stream line.
 */
function formatVariant(variant: HLSVariant): string {
  const attrs: string[] = [
    `BANDWIDTH=${variant.bandwidth}`,
  ];

  if (variant.averageBandwidth) {
    attrs.push(`AVERAGE-BANDWIDTH=${variant.averageBandwidth}`);
  }

  if (variant.resolution) {
    attrs.push(`RESOLUTION=${variant.resolution.width}x${variant.resolution.height}`);
  }

  if (variant.frameRate) {
    attrs.push(`FRAME-RATE=${variant.frameRate.toFixed(3)}`);
  }

  attrs.push(`CODECS="${variant.codecs}"`);

  if (variant.audioGroup) {
    attrs.push(`AUDIO="${variant.audioGroup}"`);
  }

  return `#EXT-X-STREAM-INF:${attrs.join(',')}`;
}

/**
 * Create a master playlist from a PlaybackPlan.
 * 
 * NOTE: Uses relative URLs so HLS.js resolves them relative to the master playlist
 * location (which is on the API server), not the page origin (which is the web app).
 */
export function createMasterPlaylistFromPlan(
  sessionId: string,
  mediaId: string,
  plan: PlaybackPlan,
  _baseUrl: string // Unused - we use relative URLs instead
): HLSMasterPlaylist {
  const variants: HLSVariant[] = [];
  const audioRenditions: HLSAudioRendition[] = [];

  // Calculate bandwidth
  const videoBitrate = plan.video.bitrate ?? estimateVideoBitrate(plan);
  const audioBitrate = plan.audio.bitrate ?? 192000;
  const bandwidth = videoBitrate + audioBitrate;

  // Build codec string
  const codecs = buildCodecString(plan);

  // Main variant - use relative URL so HLS.js resolves relative to master playlist
  variants.push({
    bandwidth,
    averageBandwidth: Math.round(bandwidth * 0.8),
    resolution: plan.video.resolution,
    codecs,
    audioGroup: plan.audioGroups ? plan.audioGroups.groupId : undefined,
    uri: 'playlist.m3u8', // Relative to master.m3u8
  });

  // Audio renditions (if multi-track) - also relative URLs
  if (plan.audioGroups) {
    for (const track of plan.audioGroups.tracks) {
      audioRenditions.push({
        groupId: plan.audioGroups.groupId,
        name: track.label,
        language: track.language,
        isDefault: track.isDefault,
        autoSelect: true,
        channels: track.channels,
        uri: `audio_${track.index}/playlist.m3u8`, // Relative to master.m3u8
      });
    }
  }

  return {
    sessionId,
    mediaId,
    variants,
    audioRenditions,
  };
}

/**
 * Create a media playlist structure.
 */
export function createMediaPlaylist(
  sessionId: string,
  mediaId: string,
  targetDuration: number
): HLSMediaPlaylist {
  return {
    sessionId,
    mediaId,
    epochIndex: 0,
    targetDuration,
    mediaSequence: 0,
    discontinuitySequence: 0,
    playlistType: 'EVENT',
    segments: [],
    endList: false,
  };
}

/**
 * Add a segment to a media playlist.
 */
export function addSegmentToPlaylist(
  playlist: HLSMediaPlaylist,
  segment: HLSSegment
): HLSMediaPlaylist {
  return {
    ...playlist,
    segments: [...playlist.segments, segment],
    // Update target duration if segment is longer
    targetDuration: Math.max(playlist.targetDuration, segment.duration),
  };
}

/**
 * Start a new epoch in the playlist.
 * This is called after seeks, track switches, or quality changes.
 */
export function startNewEpoch(
  playlist: HLSMediaPlaylist,
  epochIndex: number
): HLSMediaPlaylist {
  return {
    ...playlist,
    epochIndex,
    discontinuitySequence: playlist.discontinuitySequence + 1,
    // Reset segment numbering for new epoch
    mediaSequence: 0,
  };
}

/**
 * Mark the playlist as complete.
 */
export function finalizePlaylist(playlist: HLSMediaPlaylist): HLSMediaPlaylist {
  return {
    ...playlist,
    playlistType: 'VOD',
    endList: true,
  };
}

/**
 * Estimate video bitrate from plan resolution.
 */
function estimateVideoBitrate(plan: PlaybackPlan): number {
  if (!plan.video.resolution) {
    // Assume 1080p
    return 8_000_000;
  }

  const { height } = plan.video.resolution;

  if (height >= 2160) return 25_000_000; // 4K
  if (height >= 1080) return 8_000_000;  // 1080p
  if (height >= 720) return 4_000_000;   // 720p
  if (height >= 480) return 2_000_000;   // 480p
  return 1_000_000; // SD
}

/**
 * Build codec string for HLS variant.
 */
function buildCodecString(plan: PlaybackPlan): string {
  const codecs: string[] = [];

  // Video codec
  if (plan.video.codec === 'h264' || plan.video.codec === 'source') {
    // avc1.PPCCLL - Profile, Constraint, Level
    codecs.push('avc1.640028'); // High profile, level 4.0
  } else if (plan.video.codec === 'hevc') {
    // hvc1.P.T.LL - Profile, Tier, Level
    codecs.push('hvc1.1.6.L120.90'); // Main profile, level 4.0
  } else if (plan.video.codec === 'av1') {
    codecs.push('av01.0.08M.08'); // Main profile, level 4.0
  }

  // Audio codec
  if (plan.audio.codec === 'aac' || plan.audio.codec === 'source') {
    codecs.push('mp4a.40.2'); // AAC-LC
  } else if (plan.audio.codec === 'ac3') {
    codecs.push('ac-3');
  } else if (plan.audio.codec === 'eac3') {
    codecs.push('ec-3');
  } else if (plan.audio.codec === 'opus') {
    codecs.push('opus');
  }

  return codecs.join(',');
}

/**
 * Parse an HLS playlist string back into structure.
 * Useful for testing and playlist manipulation.
 */
export function parseMediaPlaylist(content: string): HLSMediaPlaylist {
  const lines = content.split('\n');
  const segments: HLSSegment[] = [];
  let targetDuration = 6;
  let mediaSequence = 0;
  let discontinuitySequence = 0;
  let playlistType: 'EVENT' | 'VOD' = 'EVENT';
  let endList = false;
  let currentDuration = 0;
  let segmentIndex = 0;
  let epochIndex = 0;
  let nextDiscontinuity = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';

    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      targetDuration = parseInt(line.split(':')[1] ?? '6', 10);
    } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      mediaSequence = parseInt(line.split(':')[1] ?? '0', 10);
    } else if (line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE:')) {
      discontinuitySequence = parseInt(line.split(':')[1] ?? '0', 10);
    } else if (line.startsWith('#EXT-X-PLAYLIST-TYPE:')) {
      playlistType = (line.split(':')[1] ?? 'EVENT') as 'EVENT' | 'VOD';
    } else if (line === '#EXT-X-ENDLIST') {
      endList = true;
    } else if (line === '#EXT-X-DISCONTINUITY') {
      nextDiscontinuity = true;
      epochIndex++;
    } else if (line.startsWith('#EXTINF:')) {
      currentDuration = parseFloat(line.split(':')[1]?.split(',')[0] ?? '0');
    } else if (line && !line.startsWith('#')) {
      // Segment filename
      segments.push({
        index: segmentIndex++,
        epochIndex,
        duration: currentDuration,
        filename: line,
        path: line,
        startTime: 0, // Would need to calculate
        endTime: currentDuration,
        discontinuity: nextDiscontinuity,
      });
      nextDiscontinuity = false;
    }
  }

  return {
    sessionId: '',
    mediaId: '',
    epochIndex,
    targetDuration,
    mediaSequence,
    discontinuitySequence,
    playlistType,
    segments,
    endList,
  };
}

/**
 * Get segment URL from a playlist.
 */
export function getSegmentUrl(
  baseUrl: string,
  segment: HLSSegment
): string {
  if (segment.filename.startsWith('http')) {
    return segment.filename;
  }
  return `${baseUrl}/${segment.filename}`;
}

/**
 * Calculate total duration of a playlist.
 */
export function getPlaylistDuration(playlist: HLSMediaPlaylist): number {
  return playlist.segments.reduce((sum, seg) => sum + seg.duration, 0);
}

/**
 * Find segment at a given time position.
 */
export function findSegmentAtTime(
  playlist: HLSMediaPlaylist,
  time: number
): HLSSegment | undefined {
  let currentTime = 0;

  for (const segment of playlist.segments) {
    if (time >= currentTime && time < currentTime + segment.duration) {
      return segment;
    }
    currentTime += segment.duration;
  }

  // Return last segment if past end
  return playlist.segments[playlist.segments.length - 1];
}

