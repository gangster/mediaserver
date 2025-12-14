# Transcoding Pipeline Architecture v5.0

> **Mission**: Enable premium playback on any device, from any server hardware, for local and remote users alike.

## Table of Contents

1. [Core Design Principles](#1-core-design-principles)
2. [Architecture Overview](#2-architecture-overview)
3. [Server Capability Detection](#3-server-capability-detection)
4. [FFmpeg Capability Manifest](#4-ffmpeg-capability-manifest)
5. [Client Capability Detection](#5-client-capability-detection)
6. [Quality Profile System](#6-quality-profile-system)
7. [PlaybackPlan: Single Source of Truth](#7-playbackplan-single-source-of-truth)
8. [Transport Layer](#8-transport-layer)
9. [Media Analysis & Metadata](#9-media-analysis--metadata)
10. [Transcoding Engine Architecture](#10-transcoding-engine-architecture)
11. [HLS Implementation](#11-hls-implementation)
12. [Session Management](#12-session-management)
13. [Audio Track & Subtitle Switching](#13-audio-track--subtitle-switching)
14. [HDR Handling](#14-hdr-handling)
15. [Content Quirks Handling](#15-content-quirks-handling)
16. [Trickplay & Seek Preview](#16-trickplay--seek-preview)
17. [User Experience Features](#17-user-experience-features)
18. [Error Recovery & Resilience](#18-error-recovery--resilience)
19. [Caching Strategy](#19-caching-strategy)
20. [Security Considerations](#20-security-considerations)
21. [API Reference](#21-api-reference)
22. [Database Schema](#22-database-schema)
23. [FFmpeg Command Reference](#23-ffmpeg-command-reference)
24. [Troubleshooting](#24-troubleshooting)
25. [Future Scope](#25-future-scope)

---

## 1. Core Design Principles

### 1.1 Playback Hierarchy (7 Tiers)

The system attempts playback modes in strict order, failing down to the next tier:

| Priority | Mode | Video | Audio | Container | When |
|----------|------|-------|-------|-----------|------|
| 1 | **Direct Play** | Source | Source | Source | Client supports everything |
| 2 | **Direct Play + Audio Transcode** | Source | Encode | Source | Video OK, audio codec unsupported |
| 3 | **Remux** | `-c:v copy` | `-c:a copy` | MP4/MKV | Container incompatible, codecs OK |
| 4 | **Remux + Audio Transcode** | `-c:v copy` | Encode | MP4/MKV | Container fix + audio transcode |
| 5 | **Remux-to-HLS** | `-c:v copy` | `-c:a copy` | HLS (TS) | Range unreliable or remote, keyframes OK |
| 6 | **Remux-to-HLS + Audio Transcode** | `-c:v copy` | Encode | HLS | Video copy OK, audio needs transcode |
| 7 | **Transcode-to-HLS** | Encode | Encode/copy | HLS | Codec unsupported or keyframes too sparse |

**Rule: Never show "format not supported" error.** Always fall back gracefully.

**Audio-only transcode is first-class.** Copying video while transcoding audio is a huge UX win (fast startup, low CPU).

### 1.2 Instant Playback

Users must start watching within **3-5 seconds** of pressing play.

**Segment duration**: 4 seconds by default (configurable).

### 1.3 Graceful Degradation

Always provide a playable option:
- Server under load → lower quality
- Network congested → reduce bitrate  
- Hardware accel fails → software fallback
- Source problematic → try different approach

### 1.4 Server Hardware Awareness

| Server Class | Examples | Max Transcodes | Strategy |
|--------------|----------|----------------|----------|
| Raspberry Pi / ARM | RPi 4, Odroid | 0 | Direct play only |
| Weak NAS | Celeron, Atom | 1 (slow) | Low quality, long buffer |
| Mid-range PC | i5/i7 6th+, Ryzen | 2 | All quality tiers |
| GPU-enabled | GTX 1060+, Intel iGPU | 4-8 | Fast, high quality |
| Enterprise | Xeon + GPU | 10+ | Pre-transcode library |

---

## 2. Architecture Overview

### 2.1 Simplified Streaming Architecture

The current implementation uses a **simplified disk-based architecture**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Client (Web Player)                         │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                  │
│  │ VideoPlayer │───▶│  hls.js    │───▶│  <video>   │                  │
│  │ (container) │    │  library   │    │  element   │                  │
│  └────────────┘    └─────┬──────┘    └────────────┘                  │
└────────────────────────────┼──────────────────────────────────────────┘
                             │ HTTP + Auth Header
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Server (Hono Routes)                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                 │
│  │ POST        │   │ GET         │   │ GET         │                 │
│  │ /session    │   │ /master.m3u8│   │ /playlist   │                 │
│  │ (create)    │   │ (from disk) │   │ .m3u8       │                 │
│  └─────────────┘   └─────────────┘   └──────┬──────┘                 │
│                                              │                        │
│  ┌────────────────────────────────────────────┴───────────────────┐  │
│  │         /tmp/mediaserver/transcode/{sessionId}/                 │  │
│  │           ├── master.m3u8      (written at session creation)    │  │
│  │           ├── playlist.m3u8   (written by FFmpeg progressively) │  │
│  │           └── segment_00000.ts, segment_00001.ts, ...           │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         FFmpeg Process                                │
│  - Spawned on session creation                                        │
│  - Reads source media file                                            │
│  - Writes segments + playlist.m3u8 to disk                           │
│  - Uses EVENT playlist type for progressive writing                  │
│  - Managed by TranscodeSessionManager                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Design Decisions

1. **Disk-based streaming**: FFmpeg writes directly to disk, routes serve files directly
2. **EVENT playlist type**: Allows "watch while transcoding" (progressive HLS)
3. **No in-memory playlist state**: Server reads FFmpeg's actual output
4. **Automatic ENDLIST**: Appended when transcoding appears complete (file unchanged for 2+ seconds)
5. **Stateless routes**: Session state stored in files, not memory (survives restart)

### 2.3 Key Files

| File | Purpose |
|------|---------|
| `apps/server/src/routes/stream.ts` | HLS routes (playlists, segments, session management) |
| `apps/server/src/services/streaming-service.ts` | Session orchestration, FFmpeg lifecycle |
| `apps/server/src/services/transcode-session.ts` | Individual FFmpeg process management |
| `apps/server/src/services/ffmpeg-builder.ts` | FFmpeg command generation |
| `apps/server/src/services/playback-planner.ts` | PlaybackPlan generation |
| `apps/server/src/services/media-probe.ts` | Media file analysis (ffprobe) |
| `apps/web/src/components/player/WebVideoPlayer.tsx` | hls.js integration |
| `apps/web/src/lib/hls-config.ts` | hls.js configuration |

---

## 3. Server Capability Detection

### 3.1 Detection Flow

At server startup:
1. **Detect CPU** → Cores, threads, model, architecture
2. **Detect GPU** → Vendor, model, VRAM, driver
3. **Generate FFmpeg Capability Manifest** → Test encoders, decoders, filters
4. **Assess Resources** → RAM, disk space
5. **Classify Server** → low | medium | high | enterprise
6. **Store Results** → Save to database

### 3.2 TypeScript Interfaces

```typescript
interface CPUInfo {
  model: string;
  vendor: 'intel' | 'amd' | 'arm' | 'apple' | 'unknown';
  cores: number;
  threads: number;
  architecture: 'x64' | 'arm64';
  benchmarkScore: number;
}

interface GPUInfo {
  vendor: 'nvidia' | 'intel' | 'amd' | 'apple' | 'none';
  model: string;
  vram: number;  // MB
  driverVersion: string;
}

interface ServerCapabilities {
  cpu: CPUInfo;
  gpu: GPUInfo;
  ffmpegManifest: FFmpegCapabilityManifest;
  serverClass: 'low' | 'medium' | 'high' | 'enterprise';
  maxConcurrentTranscodes: number;
  maxConcurrentThumbnailJobs: number;
  ramMB: number;
  scratchDiskSpaceGB: number;
  hwaccel: {
    cuda: boolean;
    nvdec: boolean;
    qsv: boolean;
    vaapi: boolean;
    videoToolbox: boolean;
    d3d11va: boolean;
  };
}
```

---

## 4. FFmpeg Capability Manifest

At startup, generate and persist a **strict capability manifest** that gates every decision branch.

```typescript
interface FFmpegCapabilityManifest {
  ffmpegVersion: string;
  ffprobeVersion: string;
  
  hwaccel: {
    cuda: boolean;
    nvdec: boolean;
    qsv: boolean;
    vaapi: boolean;
    videotoolbox: boolean;
    d3d11va: boolean;
  };
  
  encoders: {
    libx264: boolean;
    libx265: boolean;
    libsvtav1: boolean;
    h264_nvenc: boolean;
    hevc_nvenc: boolean;
    h264_videotoolbox: boolean;
    hevc_videotoolbox: boolean;
    // ... etc
  };
  
  filters: {
    tonemap: boolean;
    tonemap_cuda: boolean;
    yadif: boolean;
    scale: boolean;
    scale_cuda: boolean;
    loudnorm: boolean;
    // ... etc
  };
  
  generatedAt: string;
}
```

---

## 5. Client Capability Detection

### 5.1 Confidence-Based Detection

| Confidence | Method | Strategy |
|------------|--------|----------|
| **High** | MediaCapabilities API | Use advanced codecs |
| **Medium** | User-Agent parsing | Try advanced, ready to fallback |
| **Low** | Unknown device | Universal fallback (H.264+AAC) |

### 5.2 Client Capabilities Interface

```typescript
interface ClientCapabilities {
  videoCodecs: {
    h264: { supported: boolean; maxLevel?: string; maxResolution?: string };
    hevc: { supported: boolean; maxLevel?: string; maxResolution?: string };
    vp9: { supported: boolean; profile?: number };
    av1: { supported: boolean };
  };
  audioCodecs: { 
    aac: boolean; 
    ac3: boolean; 
    eac3: boolean; 
    dts: boolean; 
    opus: boolean; 
    flac: boolean;
  };
  maxAudioChannels: number;
  hdr: { 
    hdr10: boolean; 
    dolbyVision: boolean; 
    hlg: boolean; 
  };
  maxResolution: '4k' | '1080p' | '720p' | '480p';
  confidenceScore: number;
  rangeReliability: 'trusted' | 'suspect' | 'untrusted';
}
```

---

## 6. Quality Profile System

### 6.1 Profile Definitions

| Profile | Resolution | H.264 Bitrate | HEVC Bitrate | Audio |
|---------|------------|---------------|--------------|-------|
| **Maximum** | 4K | 25 Mbps | 15 Mbps | 640k 5.1 |
| **High** | 1080p | 10 Mbps | 6 Mbps | 384k 5.1 |
| **Medium** | 720p | 5 Mbps | 3 Mbps | 256k stereo |
| **Low** | 480p | 2 Mbps | 1.2 Mbps | 128k stereo |
| **Minimum** | 360p | 800 kbps | 500 kbps | 96k stereo |

### 6.2 Quality Label Assignment

Quality labels are assigned based on video height using tier thresholds:

```typescript
export function getQualityLabel(height: number): string {
  if (height >= 1800) return '4K';      // Covers 2160p and widescreen 4K (3840x1600)
  if (height >= 800) return '1080p';    // Covers 1080p and widescreen (1920x800)
  if (height >= 600) return '720p';
  if (height >= 400) return '480p';
  if (height >= 300) return '360p';
  if (height >= 200) return '240p';
  return `${height}p`;
}
```

This tier-based approach correctly handles widescreen aspect ratios where the height is lower than standard 16:9 content.

---

## 7. PlaybackPlan: Single Source of Truth

### 7.1 Overview

The **PlaybackPlan** is the canonical output of all decision-making. It's computed once and drives everything: FFmpeg command building, URL generation, cache keys, and logging.

### 7.2 PlaybackPlan Structure

```typescript
interface PlaybackPlan {
  planId: string;
  sessionId: string;
  mediaId: string;
  userId: string;
  
  // Transport & Mode
  transport: 'range' | 'hls';
  mode: PlaybackMode;
  container: 'source' | 'mp4' | 'mkv' | 'hls_ts' | 'hls_fmp4';
  
  // Video Track
  video: {
    action: 'copy' | 'encode';
    sourceIndex: number;
    codec: 'source' | 'h264' | 'hevc' | 'av1' | 'vp9';
    encoder?: string;
    hwaccel: boolean;
    profile?: string;
    level?: string;
    bitrate?: number;
    crf?: number;
    resolution?: { width: number; height: number };
    filters: string[];
  };
  
  // Audio Track
  audio: {
    action: 'copy' | 'encode';
    sourceIndex: number;
    codec: 'source' | 'aac' | 'ac3' | 'eac3' | 'opus';
    channels: number;
    bitrate?: number;
    filters: string[];
  };
  
  // Subtitles
  subtitles: {
    mode: 'none' | 'sidecar' | 'burn';
    sourceIndex?: number;
    format?: 'webvtt' | 'source';
  };
  
  // HDR Handling
  hdr: {
    sourceFormat: 'sdr' | 'hdr10' | 'hdr10plus' | 'hlg' | 'dv_p5' | 'dv_p7' | 'dv_p8';
    mode: 'passthrough' | 'convert_hdr10' | 'extract_hdr10_base' | 'tonemap_sdr';
    tonemapFilter?: string;
  };
  
  // Content Quirks
  quirks: {
    deinterlace?: { filter: string; reason: string };
    vfrToCfr?: { targetFps: number; reason: string };
  };
  
  // Decision Audit
  reasonCodes: PlaybackReasonCode[];
  decisionPath: string[];
  
  // Cache Key
  cacheKey: string;
  
  createdAt: string;
}

type PlaybackMode =
  | 'direct'
  | 'direct_audio_transcode'
  | 'remux'
  | 'remux_audio_transcode'
  | 'remux_hls'
  | 'remux_hls_audio_transcode'
  | 'transcode_hls';
```

---

## 8. Transport Layer

### 8.1 Range vs HLS Decision

| Condition | Transport | Rationale |
|-----------|-----------|-----------|
| Direct play + LAN | Range | Lowest latency |
| Any transcode | HLS | Seek flexibility, progressive delivery |
| Remote access | HLS | Better for variable connections |
| Unknown client | HLS | Most compatible |

### 8.2 Current Implementation

All transcoding uses **HLS transport** with:
- 4-second segments
- MPEG-TS container (`.ts`)
- EVENT playlist type for progressive writing

---

## 9. Media Analysis & Metadata

### 9.1 Probe Result Structure

```typescript
interface MediaProbeResult {
  filePath: string;
  fileSize: number;
  fingerprint: string;  // `${fileSize}_${mtime}`
  
  format: {
    name: string;
    duration: number;
    bitrate: number;
    startTime: number;
  };
  
  videoStreams: VideoStreamInfo[];
  audioStreams: AudioStreamInfo[];
  subtitleStreams: SubtitleStreamInfo[];
  chapters: ChapterInfo[];
  
  keyframeAnalysis?: KeyframeAnalysis;
  contentQuirks: ContentQuirks;
}

interface VideoStreamInfo {
  index: number;
  codec: string;
  profile?: string;
  level?: number;
  width: number;
  height: number;
  frameRate: number;
  bitrate?: number;
  isInterlaced: boolean;
  hdrFormat?: 'sdr' | 'hdr10' | 'hdr10plus' | 'hlg' | 'dv';
}
```

---

## 10. Transcoding Engine Architecture

### 10.1 Session Creation Flow

```
POST /api/stream/session
         │
         ▼
┌─────────────────────────────────────────┐
│     StreamingService.createSession()     │
│  1. Lookup media file in database        │
│  2. Probe media with FFprobe             │
│  3. Detect client capabilities           │
│  4. Generate PlaybackPlan                │
│  5. Create session output directory      │
│  6. Write master.m3u8 to disk            │
│  7. Start FFmpeg transcode process       │
│  8. Return session info + URLs           │
└─────────────────────────────────────────┘
```

### 10.2 TranscodeSessionManager

Manages concurrent FFmpeg processes with admission control:

```typescript
const SESSION_CONFIG = {
  cacheDir: '/tmp/mediaserver/transcode',
  segmentDuration: 4,
  maxSegmentsBehindPlayhead: 5,
  firstSegmentTimeoutMs: 45000,  // 45s for slow 4K transcodes
  noProgressTimeoutMs: 60000,    // 60s
};
```

### 10.3 FFmpeg Process Lifecycle

1. **Spawn**: FFmpeg started with arguments from PlaybackPlan
2. **Monitor**: Watch for segment files appearing on disk
3. **Track**: Count segments, monitor progress via stderr parsing
4. **Timeout**: Kill if no progress after timeout
5. **Cleanup**: Remove session files on end

#### Stopping FFmpeg Safely

When stopping FFmpeg (seek, pause, or end), use this sequence to prevent race conditions:

```typescript
// In TranscodeSession:
async stopFFmpeg(): Promise<void> {
  this.ffmpegState.status = 'stopping';  // MUST set before kill
  ffmpeg.kill('SIGTERM');
  // Wait for close event
}

// In handleFFmpegExit:
if (this.ffmpegState.status === 'stopping') {
  // Intentional stop - do NOT restart
  this.ffmpegState.status = 'stopped';
} else if (this.state.status === 'active') {
  // Unexpected exit - attempt restart
  this.handleFFmpegFailure();
}
```

#### Seek Mutex

Seeks must be serialized to prevent multiple FFmpeg processes:

```typescript
private seekInProgress: Promise<void> | null = null;

async seek(position: number): Promise<void> {
  // Wait for any in-progress seek
  if (this.seekInProgress) {
    await this.seekInProgress;
  }
  
  this.seekInProgress = this.doSeek(position);
  try {
    await this.seekInProgress;
  } finally {
    this.seekInProgress = null;
  }
}
```

#### Session Status Transitions

```
active → ending → ended       (normal end)
active → paused → active      (pause/resume)
active → error                (fatal failure)
```

The `ending` state is critical: it's set BEFORE calling `stopFFmpeg()` to signal that any FFmpeg exit during this window is intentional and should NOT trigger a restart.

---

## 11. HLS Implementation

### 11.1 Playlist Architecture

**Master Playlist** (`master.m3u8`):
- Written by server at session creation
- Contains variant stream info
- Points to `playlist.m3u8`

**Media Playlist** (`playlist.m3u8`):
- Written by FFmpeg progressively
- Uses `EVENT` type for live transcoding
- Server appends `#EXT-X-ENDLIST` when complete

### 11.2 FFmpeg HLS Output Arguments

```bash
ffmpeg -i input.mkv \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k \
  -f hls \
  -hls_time 4 \                          # 4-second segments
  -hls_list_size 0 \                     # Keep all segments in playlist
  -hls_playlist_type event \             # Progressive writing
  -hls_segment_filename segment_%05d.ts \
  -start_number 0 \
  -hls_flags independent_segments \
  -muxdelay 0 \
  -muxpreload 0 \
  -avoid_negative_ts make_zero \
  -start_at_zero \
  -g 120 \                               # GOP size (4s @ 30fps)
  -keyint_min 120 \
  -sc_threshold 0 \                      # Disable scene change detection
  -force_key_frames expr:gte(t,n_forced*4) \
  playlist.m3u8
```

### 11.3 Key HLS Flags Explained

| Flag | Value | Purpose |
|------|-------|---------|
| `-hls_time` | 4 | 4-second segment duration |
| `-hls_list_size` | 0 | Keep all segments (don't delete old ones) |
| `-hls_playlist_type` | event | Progressive writing for live transcoding |
| `-hls_flags` | independent_segments | Each segment self-contained |
| `-muxdelay 0` | - | Lower latency startup |
| `-avoid_negative_ts` | make_zero | Clean PTS timestamps |
| `-start_at_zero` | - | PTS starts at 0 |
| `-force_key_frames` | expr:gte(t,n_forced*4) | Keyframe every 4 seconds |

### 11.4 HLS.js Configuration (Client)

The web player uses hls.js with specific configuration for "watch while transcoding":

```typescript
export const hlsConfig: Partial<Hls['config']> = {
  // Start from beginning, not "live edge"
  startLevel: -1,
  autoStartLoad: true,

  // Buffer settings
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  backBufferLength: Infinity,  // Keep all buffered content

  // Treat EVENT playlist as VOD-like (don't jump to live edge)
  liveSyncDuration: 9999,
  liveMaxLatencyDuration: 10000,  // MUST be > liveSyncDuration
  liveDurationInfinity: false,

  // Error recovery
  fragLoadingMaxRetry: 4,
  manifestLoadingMaxRetry: 4,
  levelLoadingMaxRetry: 4,
};
```

**Critical**: `liveMaxLatencyDuration` MUST be greater than `liveSyncDuration` or hls.js throws a validation error.

### 11.5 Auth Token Injection

HLS.js requests need authorization headers:

```typescript
export async function createHlsConfig(dataSaver = false): Promise<Partial<Hls['config']>> {
  const token = await getAccessToken();
  
  return {
    ...baseConfig,
    xhrSetup: (xhr: XMLHttpRequest, url: string) => {
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
    },
  };
}
```

**Note**: `getAccessToken()` is async because it must wait for Zustand store hydration.

---

## 12. Session Management

### 12.1 Session Lifecycle

```
Create Session
      │
      ├── Generate PlaybackPlan
      ├── Create output directory
      ├── Write master.m3u8
      ├── Start FFmpeg process
      │
      ▼
Active Session
      │
      ├── Client fetches playlists/segments
      ├── Heartbeat updates lastAccessAt
      │
      ▼
Session End (one of):
      │
      ├── Client calls DELETE /session
      ├── Idle timeout (60s without heartbeat)
      └── FFmpeg process ends
      │
      ▼
Cleanup
      │
      ├── Kill FFmpeg process (if running)
      ├── Remove session files
      └── Clear from memory
```

### 12.2 Automatic Session Cleanup

The StreamingService runs a cleanup timer to remove idle sessions:

```typescript
// Configuration
sessionIdleTimeoutMs: 60_000,   // 60 seconds without heartbeat
cleanupIntervalMs: 15_000,      // Check every 15 seconds

// Cleanup logic
private async cleanupIdleSessions() {
  const now = Date.now();
  for (const [sessionId, session] of this.sessions) {
    const lastAccess = new Date(session.lastAccessAt).getTime();
    if (now - lastAccess > this.sessionIdleTimeoutMs) {
      await this.endSession(sessionId);
    }
  }
}
```

### 12.3 Session State Storage

**In-memory** (`PlaybackSessionInfo`):
- Session metadata
- PlaybackPlan
- FFmpeg process reference
- Last access timestamp

**On-disk** (`/tmp/mediaserver/transcode/{sessionId}/`):
- master.m3u8
- playlist.m3u8 (written by FFmpeg)
- segment_00000.ts, segment_00001.ts, ...

### 12.4 Seeking Past Transcoded Content

When a user seeks to a position that hasn't been transcoded yet, the system handles it gracefully:

**Client-side logic:**
```
User initiates seek to position X
      │
      ├── If X <= transcodedTime + 30s
      │   └── Local seek (hls.js handles it)
      │
      └── If X > transcodedTime + 30s
          │
          ├── Call server-side seek endpoint
          ├── Server restarts FFmpeg at position X
          ├── Server waits for first segment
          └── Client reloads HLS source
```

**Server-side seek process:**
1. Stop current FFmpeg process
2. Create new epoch (discontinuity marker)
3. Restart FFmpeg with `-ss {position}` (fast seek)
4. Wait for first segment to be ready
5. Return epoch info to client

**API Endpoint:**
```typescript
// POST /api/trpc/playback.seek
{
  sessionId: string;
  position: number;  // Target position in source file time
}

// Response
{
  success: boolean;
  epochIndex: number;       // New epoch number
  startPosition: number;    // Actual seek position
  transcodedTime: number;   // How far new epoch has transcoded
}
```

**Epoch handling:** Each seek creates a new epoch with a discontinuity marker in the HLS playlist. The discontinuity tells hls.js to reset its timing model. The new epoch's segments start at index 0, but represent the content from the seek position.

**Client reload:** After server seek completes, the client calls `playerRef.current.reloadSource()` which:
1. Stops current HLS load
2. Reloads the playlist (fetches new epoch)
3. Starts playback from beginning of new epoch (position 0 in playlist = seek position in source)

---

## 13. Audio Track & Subtitle Switching

### 13.1 Audio Codec Decision Matrix

| Source | Client AAC | Client AC3 | Action |
|--------|------------|------------|--------|
| AAC | ✅ | - | Passthrough |
| AC3 | ❌ | ✅ | Passthrough |
| AC3 | ❌ | ❌ | Transcode → AAC |
| EAC3 | ❌ | ✅ | Passthrough |
| TrueHD | ❌ | ✅ | Transcode → AC3 5.1 |
| TrueHD | ❌ | ❌ | Transcode → AAC stereo |
| DTS | ❌ | ✅ | Transcode → AC3 |
| DTS | ❌ | ❌ | Transcode → AAC |

### 13.2 Subtitle Handling

| Format | Type | Render Method |
|--------|------|---------------|
| WebVTT/SRT | Text | Client-side |
| ASS/SSA simple | Text | Convert to WebVTT |
| ASS/SSA complex | Text | Burn into video |
| PGS/VOBSUB | Image | Burn into video |

---

## 14. HDR Handling

### 14.1 HDR Decision Flow

```typescript
function determineHDRHandling(media, client, manifest): PlaybackPlan['hdr'] {
  const hdrFormat = detectHDRFormat(media);
  
  if (hdrFormat === 'sdr') {
    return { sourceFormat: 'sdr', mode: 'passthrough' };
  }
  
  // Client supports this HDR format?
  if (clientSupportsHDR(client, hdrFormat)) {
    return { sourceFormat: hdrFormat, mode: 'passthrough' };
  }
  
  // Need to tonemap to SDR
  return {
    sourceFormat: hdrFormat,
    mode: 'tonemap_sdr',
    tonemapFilter: selectToneMapFilter(manifest),
  };
}
```

### 14.2 Tone Mapping Filters

```bash
# Software (zscale + tonemap)
-vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"

# NVIDIA CUDA
-vf "tonemap_cuda=tonemap=hable:desat=0:format=yuv420p"
```

---

## 15. Content Quirks Handling

### 15.1 Interlaced Content

Detection: `field_order` in ffprobe output

```bash
# Deinterlace with yadif
ffmpeg -i interlaced.mkv -vf "yadif=0:0:0" output.mp4

# Hardware (CUDA)
ffmpeg -i interlaced.mkv -vf "yadif_cuda" output.mp4
```

### 15.2 Variable Frame Rate (VFR)

Detection: Multiple `avg_frame_rate` values, or container indicates VFR

```bash
# Convert to constant frame rate
ffmpeg -i vfr.mp4 -vsync cfr -r 30 output.mp4
```

### 15.3 Legacy Containers

| Container | Issue | Solution |
|-----------|-------|----------|
| AVI | No streaming | Remux to MP4 |
| WMV/ASF | DRM, poor seek | Remux or transcode |
| FLV | Flash-era | Remux to MP4 |

---

## 16. Trickplay & Seek Preview

### 16.1 Thumbnail Generation

```bash
ffmpeg -i input.mkv \
  -vf "fps=1/10,scale=320:-1" \
  -q:v 5 \
  thumbnails/thumb_%04d.jpg
```

### 16.2 Sprite Generation

Combine thumbnails into sprite sheets for efficient loading:

```typescript
interface TrickplayConfig {
  interval: 10,           // seconds between thumbnails
  width: 320,             // thumbnail width
  spriteColumns: 5,       // thumbnails per row
  spriteRows: 5,          // rows per sprite
  quality: 75,            // JPEG quality
}
```

---

## 17. User Experience Features

### 17.1 Resume Position

Resume time is **always stored in source-file time**, regardless of playback speed.

```typescript
interface WatchProgress {
  userId: string;
  mediaId: string;
  position: number;       // Source time in seconds
  duration: number;       // Total duration
  percentage: number;     // Completion percentage
  updatedAt: string;
}
```

### 17.2 Duration Handling

The server returns the actual duration from media probe in the session creation response. This is used as the authoritative duration because hls.js may report `Infinity` for EVENT playlists.

```typescript
// Server
return {
  sessionId,
  duration: probe.format.duration,  // From ffprobe
  // ...
};

// Client
const knownDurationRef = useRef<number | null>(null);
useEffect(() => {
  if (session?.duration && session.duration > 0) {
    knownDurationRef.current = session.duration;
    setDuration(session.duration);
  }
}, [session]);
```

### 17.3 Premature "Ended" Event Handling

HLS.js may fire the `ended` event when it runs out of buffered segments during live transcoding. The player checks if we're actually near the end:

```typescript
const handleEnded = () => {
  if (knownDuration && currentTime >= knownDuration - 10) {
    // Actually ended
    emitStateChange({ status: 'ended' });
  } else {
    // HLS.js ran out of segments, just buffering
    emitStateChange({ status: 'buffering' });
  }
};
```

---

## 18. Error Recovery & Resilience

### 18.1 Timeout Policy

| Timeout | Value | Action |
|---------|-------|--------|
| First segment deadline | 45s | Restart with lower quality |
| No-progress timeout | 60s | Kill FFmpeg, retry |
| Session idle timeout | 60s | End session, cleanup |

### 18.2 HLS.js Error Recovery

```typescript
hls.on(Hls.Events.ERROR, (event, data) => {
  if (data.fatal) {
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        if (retryCount < 3) {
          hls.startLoad();  // Retry
        }
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        if (retryCount < 3) {
          hls.recoverMediaError();
        }
        break;
    }
  }
});
```

---

## 19. Caching Strategy

### 19.1 Cache Structure

```
/tmp/mediaserver/transcode/
├── {sessionId}/
│   ├── master.m3u8
│   ├── playlist.m3u8
│   └── segment_00000.ts ...
```

### 19.2 Cleanup on Session End

When a session ends:
1. Kill FFmpeg process
2. Delete session directory
3. Clear from memory

---

## 20. Security Considerations

### 20.1 Authentication

All stream routes require JWT authentication:

```typescript
streamRouter.use('/*', async (c, next) => {
  // Try Authorization header first
  let token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  // Fall back to query param (for HLS segments)
  if (!token) {
    token = c.req.query('token');
  }
  
  // Verify token
  const payload = verifyAccessToken(token, JWT_SECRET);
  c.set('userId', payload.sub);
  c.set('userRole', payload.role);
  
  await next();
});
```

### 20.2 Authorization

Session ownership is validated:
- Only session owner can access session
- Admin can access any session
- Session info endpoint checks ownership

---

## 21. API Reference

### 21.1 Create Session

```
POST /api/stream/session
Authorization: Bearer <token>
Content-Type: application/json

{
  "mediaType": "movie" | "episode",
  "mediaId": "<uuid>",
  "startPosition": 0,
  "audioTrackIndex": 0,
  "subtitleTrackIndex": null,
  "burnSubtitles": false
}

Response:
{
  "sessionId": "<nanoid>",
  "masterPlaylist": "/api/stream/<sessionId>/master.m3u8",
  "directPlay": false,
  "startPosition": 0,
  "duration": 7200.5,
  "plan": {
    "mode": "transcode_hls",
    "transport": "hls",
    "container": "hls_ts",
    "video": { "action": "encode", "codec": "h264" },
    "audio": { "action": "copy", "codec": "aac", "channels": 2 }
  }
}
```

### 21.2 Get Master Playlist

```
GET /api/stream/<sessionId>/master.m3u8
Authorization: Bearer <token>

Response: application/vnd.apple.mpegurl
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"
playlist.m3u8
```

### 21.3 Get Media Playlist

```
GET /api/stream/<sessionId>/playlist.m3u8
Authorization: Bearer <token>

Response: application/vnd.apple.mpegurl
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:EVENT

#EXTINF:4.000000,
segment_00000.ts
#EXTINF:4.000000,
segment_00001.ts
...
```

### 21.4 Get Segment

```
GET /api/stream/<sessionId>/segment_00000.ts
Authorization: Bearer <token>

Response: video/MP2T (binary)
```

### 21.5 Session Heartbeat

```
POST /api/stream/<sessionId>/heartbeat
Authorization: Bearer <token>
Content-Type: application/json

{
  "position": 125.5,
  "isPlaying": true
}

Response:
{
  "success": true,
  "sessionId": "<sessionId>",
  "position": 125.5,
  "isPlaying": true
}
```

### 21.6 End Session

```
DELETE /api/stream/<sessionId>
Authorization: Bearer <token>

Response:
{
  "success": true,
  "sessionId": "<sessionId>"
}
```

---

## 22. Database Schema

### 22.1 Playback Sessions Table

```sql
CREATE TABLE playback_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  media_type TEXT NOT NULL,  -- 'movie' | 'episode'
  playback_plan TEXT NOT NULL,  -- JSON PlaybackPlan
  
  current_position REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_heartbeat TEXT,
  ended_at TEXT
);
```

### 22.2 Watch Progress Table

```sql
CREATE TABLE watch_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  
  position REAL NOT NULL,
  duration REAL NOT NULL,
  percentage REAL NOT NULL,
  
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, media_id, media_type)
);
```

---

## 23. FFmpeg Command Reference

### 23.1 Universal Fallback (H.264 + AAC)

```bash
ffmpeg -i input.mkv \
  -c:v libx264 -preset fast -crf 23 -profile:v high -level 4.0 \
  -c:a aac -b:a 128k -ac 2 \
  -f hls -hls_time 4 -hls_list_size 0 -hls_playlist_type event \
  -muxdelay 0 -muxpreload 0 -avoid_negative_ts make_zero -start_at_zero \
  playlist.m3u8
```

### 23.2 Video Copy + Audio Transcode

```bash
ffmpeg -i input.mkv \
  -c:v copy \
  -c:a aac -b:a 256k -ac 2 \
  -f hls -hls_time 4 -hls_list_size 0 -hls_playlist_type event \
  playlist.m3u8
```

### 23.3 NVIDIA NVENC (Hardware)

```bash
ffmpeg -hwaccel cuda -hwaccel_output_format cuda -i input.mkv \
  -c:v h264_nvenc -preset p4 -tune hq -rc vbr -cq 23 -b:v 10M \
  -c:a aac -b:a 384k \
  -f hls -hls_time 4 playlist.m3u8
```

### 23.4 Apple VideoToolbox (macOS)

```bash
ffmpeg -i input.mkv \
  -c:v h264_videotoolbox -b:v 8M \
  -c:a aac -b:a 256k \
  -f hls -hls_time 4 playlist.m3u8
```

### 23.5 HDR to SDR Tone Mapping

```bash
# Software
ffmpeg -i hdr.mkv \
  -vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p" \
  -c:v libx264 -crf 18 output.mp4

# NVIDIA CUDA
ffmpeg -hwaccel cuda -i hdr.mkv \
  -vf "tonemap_cuda=tonemap=hable:desat=0:format=yuv420p" \
  -c:v h264_nvenc output.mp4
```

### 23.6 Deinterlacing

```bash
ffmpeg -i interlaced.mkv -vf "yadif=0:0:0" -c:v libx264 output.mp4
```

### 23.7 Media Probing

```bash
ffprobe -v quiet -print_format json -show_format -show_streams input.mkv
```

---

## 24. Troubleshooting

### 24.1 Video Player Stuck on Spinner

1. **Check session creation**: Network tab should show successful POST to `/api/stream/session`
2. **Check master.m3u8**: Should return valid HLS playlist
3. **Check playlist.m3u8**: Should contain `#EXTINF` entries
4. **Check FFmpeg**: Server logs should show "Starting FFmpeg" and segment generation
5. **Check auth**: All HLS requests need Authorization header

**Resume stuck specifically:** If the video shows the correct resume position but spinner persists:
- For transcoded content, `startTime` prop to video element must be `0` (not the resume position)
- FFmpeg already starts at the resume position via `-ss`
- The `epochOffset` handles translating display time
- Check that `WebVideoPlayer` receives `startTime={session?.directPlay ? startPosition : 0}`

### 24.2 Playback Erratic/Jumping

1. **Check hls.js config**: Ensure `liveSyncDuration` and `liveMaxLatencyDuration` are set high
2. **Check duration**: Player should use server-provided duration, not hls.js duration
3. **Check playlist type**: Should be EVENT (not VOD) for live transcoding

### 24.3 Duration Shows Infinity

This is normal for EVENT playlists. The player should use the duration from the session creation response, not from hls.js.

### 24.4 Multiple FFmpeg Processes / FFmpeg Leak

**Symptom**: `ps aux | grep ffmpeg` shows many processes for the same session, using excessive CPU.

**Causes**:
1. **Seek race condition**: Multiple rapid seeks spawn FFmpeg before previous one is killed
2. **Exit handler restart**: FFmpeg killed during seek triggers unwanted restart

**Fixes applied**:
- Seek mutex (`seekInProgress` promise) prevents concurrent seek operations
- `handleFFmpegExit` checks `ffmpegState.status === 'stopping'` to skip restart for intentional stops
- Session sets `status = 'ending'` BEFORE calling `stopFFmpeg()` to prevent race

**Cleanup**:
```bash
# Kill stuck FFmpeg processes
pkill -9 -f "ffmpeg.*transcode"

# Clean transcode directory
rm -rf /tmp/mediaserver/transcode/*
```

### 24.5 First Segment Timeout

Increase `firstSegmentTimeoutMs` in session config. 4K transcoding on slower hardware can take 45+ seconds for first segment.

### 24.6 HLS.js Config Validation Error

Error: `liveMaxLatencyDuration must be greater than liveSyncDuration`

Fix: Ensure `liveMaxLatencyDuration > liveSyncDuration` in hls-config.ts.

### 24.7 Quality Label Incorrect for Widescreen

The quality labeling uses tier-based height thresholds to handle widescreen content (e.g., 1920x804 shows as "1080p" not "804p").

### 24.8 HLS.js `bufferSeekOverHole` Warning

**Error**: `{ type: "mediaError", details: "bufferSeekOverHole", fatal: false }`

**This is normal and non-fatal.** HLS.js detected a small timestamp gap (typically 0-0.1s) at the start of transcoded content and automatically seeked over it. This happens because:
- FFmpeg seeks to the nearest keyframe (not exact position)
- First segment timestamps may not start exactly at 0

The `maxBufferHole: 0.5` config setting allows hls.js to automatically handle gaps up to 0.5 seconds.

### 24.9 Seek Sometimes Works, Sometimes Doesn't

**Cause**: Client wasn't tracking `transcodedTime` properly, leading to wrong local vs server-side seek decisions.

**Fix**: 
- Heartbeat now returns `transcodedTime` from server
- Client updates `transcodedTime` state on each heartbeat
- `transcodedTime` initialized to `startPosition` on session creation
- Seek logic compares target vs `transcodedTime + 30s` buffer to decide

---

## 25. Future Scope

### 25.1 Planned Features

- **Multi-variant HLS**: Multiple quality levels in master playlist
- **ABR (Adaptive Bitrate)**: Client-driven quality switching
- **Seek optimization**: Pre-transcode around seek points
- **Session persistence**: Survive server restart
- **Cache sharing**: Reuse transcoded segments across users

### 25.2 Low-Latency HLS

- Partial segments
- Preload hints
- Blocking playlist reload

### 25.3 External Players

- DLNA/UPnP
- Chromecast
- AirPlay

---

## Changelog

### Version 5.0 - Simplified Architecture

| Section | Change |
|---------|--------|
| §2 | **NEW** - Architecture overview with simplified disk-based approach |
| §6.2 | **ADDED** - Quality label assignment with tier thresholds |
| §11 | **REWRITTEN** - Complete HLS implementation details |
| §12 | **NEW** - Session management with automatic cleanup |
| §17 | **EXPANDED** - Duration handling, premature ended event |
| §21 | **NEW** - Complete API reference |
| §24 | **NEW** - Troubleshooting guide |

### Version 4.0 - Production Hardening

- Added audio-only transcode as first-class tier
- FFmpeg Capability Manifest
- PlaybackPlan as single source of truth
- HLS correctness contracts
- Content quirks handling
- Cache GC and disk pressure controls
