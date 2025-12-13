# Transcoding Pipeline Architecture v3.0

> **Mission**: Enable premium playback on any device, from any server hardware, for local and remote users alike.

## Table of Contents

1. [Core Design Principles](#1-core-design-principles)
2. [Server Capability Detection](#2-server-capability-detection)
3. [Client Capability Detection](#3-client-capability-detection)
4. [Quality Profile System](#4-quality-profile-system)
5. [Transport Layer](#5-transport-layer)
6. [Media Analysis & Metadata](#6-media-analysis--metadata)
7. [Transcoding Engine Architecture](#7-transcoding-engine-architecture)
8. [HLS Correctness Contracts](#8-hls-correctness-contracts)
9. [Live Transcoding & Seek Behavior](#9-live-transcoding--seek-behavior)
10. [Audio Track & Subtitle Switching](#10-audio-track--subtitle-switching)
11. [HDR Handling](#11-hdr-handling)
12. [Content Quirks Handling](#12-content-quirks-handling)
13. [Trickplay & Seek Preview](#13-trickplay--seek-preview)
14. [User Experience Features](#14-user-experience-features)
15. [Error Recovery & Resilience](#15-error-recovery--resilience)
16. [Caching Strategy](#16-caching-strategy)
17. [Security Considerations](#17-security-considerations)
18. [Bandwidth Measurement & Adaptation](#18-bandwidth-measurement--adaptation)
19. [Offline Downloads Support](#19-offline-downloads-support)
20. [Multi-Version Media Handling](#20-multi-version-media-handling)
21. [Monitoring & Observability](#21-monitoring--observability)
22. [Operational Concerns](#22-operational-concerns)
23. [API Versioning & Client Contract](#23-api-versioning--client-contract)
24. [Testing Strategy](#24-testing-strategy)
25. [Database Schema](#25-database-schema)
26. [FFmpeg Command Reference](#26-ffmpeg-command-reference)
27. [Implementation Phases](#27-implementation-phases)
28. [Future Scope](#28-future-scope)

---

## 1. Core Design Principles

### 1.1 Playback Hierarchy

The system attempts playback modes in strict order, failing down to the next tier:

| Priority | Mode | Video | Audio | Container | When |
|----------|------|-------|-------|-----------|------|
| 1 | **Direct Play** | Source | Source | Source | Client supports everything |
| 2 | **Remux** | `-c:v copy` | `-c:a copy` | MP4/MKV | Container incompatible, codecs OK |
| 3 | **Remux-to-HLS** | `-c:v copy` | `-c:a copy` | HLS (TS/fMP4) | Range unreliable or remote, keyframes OK |
| 4 | **Transcode-to-HLS** | Encode | Encode/copy | HLS | Codec unsupported or keyframes too sparse |

**Rule: Never show "format not supported" error**

#### 1.1.1 Remux Correctness Constraints

When remuxing to MP4 for direct streaming:

```bash
# Required flags for MP4 remux
ffmpeg -i input.mkv \
  -c:v copy -c:a copy \
  -movflags +faststart \       # moov atom at start for streaming
  -map 0:v:0 -map 0:a:0 \      # explicit track selection
  -sn \                        # drop subtitles (can't stream embedded PGS)
  output.mp4
```

**Defaults:**
- Always apply `+faststart` for streaming MP4s
- Drop image-based subtitles (PGS/VOBSUB) from MP4 remux
- Preserve text subtitles only if client explicitly supports them in container

#### 1.1.2 Remux-to-HLS Gating (Keyframe Check)

Before allowing remux-to-HLS (`-c:v copy` into HLS), validate keyframe intervals:

```typescript
interface KeyframeAnalysis {
  maxInterval: number;    // seconds
  avgInterval: number;    // seconds  
  isRegular: boolean;     // variance < 20%
}

const REMUX_HLS_THRESHOLDS = {
  maxKeyframeInterval: 8,  // seconds - reject if any gap > 8s
  avgKeyframeInterval: 4,  // seconds - warn if avg > 4s
};

function canRemuxToHLS(analysis: KeyframeAnalysis): boolean {
  return analysis.maxInterval <= REMUX_HLS_THRESHOLDS.maxKeyframeInterval;
}
```

**Action on failure:** Fall through to Transcode-to-HLS.

### 1.2 Instant Playback

Users must start watching within **3-5 seconds** of pressing play.

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

## 2. Server Capability Detection

### 2.1 Detection Flow

At server startup:
1. **Detect CPU** → Cores, threads, model, architecture
2. **Detect GPU** → Vendor, model, VRAM, driver
3. **Probe FFmpeg Encoders** → Test each for availability
4. **Assess Resources** → RAM, disk space
5. **Classify Server** → low | medium | high | enterprise
6. **Store Results** → Save to database

### 2.2 TypeScript Interfaces

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
  encoders: { h264: boolean; hevc: boolean; av1: boolean };
  decoders: { h264: boolean; hevc: boolean; av1: boolean; vp9: boolean };
}

interface ServerCapabilities {
  cpu: CPUInfo;
  gpu: GPUInfo;
  availableEncoders: EncoderCapability[];
  availableDecoders: DecoderCapability[];
  serverClass: 'low' | 'medium' | 'high' | 'enterprise';
  maxConcurrentTranscodes: number;
  maxConcurrentThumbnailJobs: number;
  ramMB: number;
  scratchDiskSpaceGB: number;
}
```

### 2.3 Encoder Detection Commands

```bash
# NVIDIA
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader

# Intel VA-API (Linux)
vainfo

# macOS VideoToolbox
ffmpeg -encoders 2>/dev/null | grep videotoolbox

# Test encoder availability
ffmpeg -y -f lavfi -i color=c=black:s=320x240:d=1 -c:v h264_nvenc -frames:v 30 -f null -

# Test decoder availability (NVDEC)
ffmpeg -y -hwaccel cuda -hwaccel_output_format cuda -f lavfi -i color=c=black:s=320x240:d=1 -frames:v 30 -f null -
```

### 2.4 Server Classification Algorithm

```typescript
function classifyServer(cpu: CPUInfo, gpu: GPUInfo, encoders: Encoder[]): ServerClass {
  const hasHardwareEncoder = encoders.some(e => e.type === 'hardware' && e.tested);
  
  if (gpu.vendor !== 'none' && cpu.threads >= 16 && hasHardwareEncoder) {
    return { class: 'enterprise', maxTranscodes: 10, maxThumbnailJobs: 4 };
  }
  if (hasHardwareEncoder) {
    return { class: 'high', maxTranscodes: Math.min(8, Math.floor(gpu.vram / 1500)), maxThumbnailJobs: 2 };
  }
  if (cpu.threads >= 4) {
    return { class: 'medium', maxTranscodes: 2, maxThumbnailJobs: 1 };
  }
  return { class: 'low', maxTranscodes: cpu.threads >= 2 ? 1 : 0, maxThumbnailJobs: 0 };
}
```

---

## 3. Client Capability Detection

### 3.1 Confidence-Based Detection

| Confidence | Method | Strategy |
|------------|--------|----------|
| **High** | MediaCapabilities API | Use advanced codecs |
| **Medium** | User-Agent parsing | Try advanced, ready to fallback |
| **Low** | Unknown device | Universal fallback (H.264+AAC) |

### 3.2 Client Capabilities Interface

```typescript
interface ClientCapabilities {
  videoCodecs: {
    h264: { supported: boolean; maxLevel?: string; maxResolution?: string };
    hevc: { supported: boolean; maxLevel?: string; maxResolution?: string };
    vp9: { supported: boolean; profile?: number };
    av1: { supported: boolean };
  };
  audioCodecs: { aac: boolean; ac3: boolean; eac3: boolean; dts: boolean; opus: boolean; flac: boolean };
  maxAudioChannels: number;
  hdr: { 
    hdr10: boolean; 
    dolbyVision: boolean; 
    dvProfile5: boolean;   // IPTPQc2 (requires DV decoder)
    dvProfile7: boolean;   // MEL (can't fallback to HDR10)
    dvProfile8: boolean;   // HLG-compatible (can fallback to HDR10)
    hlg: boolean; 
  };
  maxResolution: '4k' | '1080p' | '720p' | '480p';
  confidenceScore: number;
  rangeReliability: 'trusted' | 'suspect' | 'untrusted';
  supportsPlaybackSpeed: boolean;
  supportsTrickplay: 'bif' | 'webvtt' | 'none';
}
```

### 3.3 Known Platform Profiles

| Platform | H.264 | HEVC | VP9 | AV1 | AC3 | HDR10 | DV | Range | Trickplay |
|----------|-------|------|-----|-----|-----|-------|-----|-------|-----------|
| iOS Safari | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | P8 | ✅ | WebVTT |
| macOS Safari | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | P8 | ✅ | WebVTT |
| Chrome Desktop | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | WebVTT |
| Android Chrome | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | WebVTT |
| Fire TV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | P5/8 | ⚠️ | BIF |
| Roku | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | BIF |
| Apple TV | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | P5/8 | ✅ | WebVTT |
| Smart TVs (generic) | ✅ | ⚠️ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ | BIF |
| **Unknown** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | none |

**Legend:** ✅ = reliable, ⚠️ = device-dependent, ❌ = assume unsupported, P5/P8 = DV Profile support

---

## 4. Quality Profile System

### 4.1 Profile Definitions

| Profile | Resolution | H.264 Bitrate | HEVC Bitrate | Audio |
|---------|------------|---------------|--------------|-------|
| **Maximum** | 4K | 25 Mbps | 15 Mbps | 640k 5.1 |
| **High** | 1080p | 10 Mbps | 6 Mbps | 384k 5.1 |
| **Medium** | 720p | 5 Mbps | 3 Mbps | 256k stereo |
| **Low** | 480p | 2 Mbps | 1.2 Mbps | 128k stereo |
| **Minimum** | 360p | 800 kbps | 500 kbps | 96k stereo |

### 4.2 Profile Selection

```typescript
function selectProfile(input: ProfileInput): TranscodingProfile | 'direct' {
  // 1. Can we direct play?
  if (canDirectPlay(input.sourceMedia, input.clientCapabilities)) {
    return 'direct';
  }
  
  // 2. Filter by server capability
  const serverCompatible = PROFILES.filter(p => isServerCompatible(p, input.serverCapabilities));
  
  // 3. Filter by client capability
  const clientCompatible = serverCompatible.filter(p => isClientCompatible(p, input.clientCapabilities));
  
  // 4. Filter by bandwidth (with 20% headroom)
  const bandwidthCompatible = clientCompatible.filter(p => getTotalBitrate(p) * 1.2 <= input.networkBandwidth);
  
  // 5. Select highest quality that doesn't upscale
  return bandwidthCompatible
    .filter(p => p.maxHeight <= input.sourceMedia.height)
    .sort((a, b) => b.bitrate - a.bitrate)[0];
}
```

---

## 5. Transport Layer

### 5.1 Range vs HLS Decision Policy

| Condition | Transport | Rationale |
|-----------|-----------|-----------|
| LAN + trusted client + direct play | Range (byte-range) | Lowest latency, simplest |
| LAN + remux needed | Range | Still fast enough |
| Remote + direct play + trusted client | Range | Simpler, works for good networks |
| Remote + any transcode | HLS | Seek flexibility, ABR support |
| Range-suspect client | HLS | Avoid playback failures |
| Any + ABR required | HLS | Only HLS supports multi-bitrate |

**Defaults:**
- LAN detection: private IP ranges (10.x, 172.16-31.x, 192.168.x) or same /24 subnet
- Remote default: HLS unless explicitly overridden by user preference
- Unknown client: HLS (safest)

### 5.2 HTTP Range Contract (RFC 7233)

When serving via byte-range (direct play, remux):

```typescript
interface RangeResponse {
  status: 206;
  headers: {
    'Content-Range': `bytes ${start}-${end}/${total}`;
    'Content-Length': string;
    'Accept-Ranges': 'bytes';
    'ETag': string;
    'Last-Modified': string;
    'Cache-Control': string;
  };
}
```

**Required behaviors:**
- Support `Range: bytes=0-` (open-ended)
- Support `Range: bytes=X-Y` (bounded)
- Support `If-Range` with ETag for resume validation
- Return `416` if range start > file size
- Return `200` with full file if `Range` header malformed (graceful fallback)

### 5.3 Range Unreliability Detection

```typescript
interface RangeHealthTracker {
  sessionId: string;
  clientId: string;
  rangeRequestCount: number;
  rangeFailures: number;
  outOfOrderRequests: number;
  failureRate: number;
}

const RANGE_POLICY = {
  failureThreshold: 0.15,
  minSamples: 5,
  penaltyDuration: 3600,
  rehabAfter: 86400,
};
```

---

## 6. Media Analysis & Metadata

### 6.1 Media Scanning Pipeline

#### 6.1.1 Scan Triggers

| Trigger | Action | Priority |
|---------|--------|----------|
| New file detected (inotify/fswatch) | Queue full scan | High |
| File modified (mtime change) | Queue rescan | High |
| Manual library refresh | Queue all unscanned | Medium |
| Scheduled maintenance | Rescan failed items | Low |
| User requests playback of unscanned | Inline scan (blocking) | Critical |

#### 6.1.2 ffprobe Workflow

```typescript
interface MediaProbeResult {
  filePath: string;
  fileSize: number;
  mtime: number;
  fingerprint: string;
  
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
  attachments: AttachmentInfo[];
  
  keyframeAnalysis: KeyframeAnalysis;
  contentQuirks: ContentQuirks;
  
  scannedAt: Date;
  scanDurationMs: number;
  ffprobeVersion: string;
}

interface VideoStreamInfo {
  index: number;
  codec: string;
  profile: string;
  level: number;
  width: number;
  height: number;
  frameRate: number;
  frameRateMode: 'cfr' | 'vfr';
  bitrate: number;
  pixelFormat: string;
  colorSpace: string;
  colorTransfer: string;
  colorPrimaries: string;
  isInterlaced: boolean;
  fieldOrder?: 'tt' | 'bb' | 'tb' | 'bt';
  hdrFormat?: 'hdr10' | 'hdr10+' | 'dolby_vision' | 'hlg' | 'sdr';
  dolbyVisionProfile?: 5 | 7 | 8;
  dolbyVisionLevel?: number;
  hasDolbyVisionEL?: boolean;
  hasHdr10PlusMetadata?: boolean;
  displayAspectRatio: string;
  sampleAspectRatio: string;
  default: boolean;
  forced: boolean;
  title?: string;
  language?: string;
}

interface AudioStreamInfo {
  index: number;
  codec: string;
  profile?: string;
  channels: number;
  channelLayout: string;
  sampleRate: number;
  bitrate: number;
  bitDepth?: number;
  language: string;
  title?: string;
  default: boolean;
  forced: boolean;
  isCommentary: boolean;
  isDescriptive: boolean;
}

interface SubtitleStreamInfo {
  index: number;
  codec: string;
  type: 'text' | 'image';
  language: string;
  title?: string;
  default: boolean;
  forced: boolean;
  isSDH: boolean;
  isCommentary: boolean;
  hearingImpaired: boolean;
}

interface ChapterInfo {
  index: number;
  startTime: number;
  endTime: number;
  title: string;
}
```

#### 6.1.3 ffprobe Commands

```bash
# Full probe with chapters and attachments
ffprobe -v quiet \
  -print_format json \
  -show_format \
  -show_streams \
  -show_chapters \
  -show_programs \
  input.mkv

# Keyframe analysis
ffprobe -v quiet \
  -select_streams v:0 \
  -show_entries packet=pts_time,flags \
  -of csv=p=0 \
  input.mkv | grep ',K' | cut -d',' -f1

# Frame analysis for interlacing detection
ffprobe -v quiet \
  -select_streams v:0 \
  -show_entries frame=interlaced_frame,top_field_first \
  -read_intervals "%+#100" \
  -of csv=p=0 \
  input.mkv
```

#### 6.1.4 Content Quirks Detection

```typescript
interface ContentQuirks {
  isInterlaced: boolean;
  interlaceType?: 'tff' | 'bff' | 'mixed';
  isVariableFrameRate: boolean;
  vfrRange?: { min: number; max: number };
  hasIrregularKeyframes: boolean;
  isTelecined: boolean;
  hasAudioSyncIssues: boolean;
  hasBFrames: boolean;
  bFrameCount?: number;
  isLegacyContainer: boolean;
  requiresContainerFix: boolean;
  audioDelayMs?: number;
}
```

### 6.2 Chapter Marker Handling

```typescript
interface ChapterMarker {
  index: number;
  title: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  type: 'chapter' | 'intro' | 'credits' | 'recap' | 'preview';
}

function classifyChapter(chapter: ChapterInfo): ChapterMarker['type'] {
  const titleLower = chapter.title.toLowerCase();
  
  const introPatterns = [/^intro$/i, /^opening$/i, /^op$/i, /^theme$/i];
  if (introPatterns.some(p => p.test(titleLower))) return 'intro';
  
  const creditsPatterns = [/^credits$/i, /^ending$/i, /^ed$/i, /end credits/i];
  if (creditsPatterns.some(p => p.test(titleLower))) return 'credits';
  
  if (/recap/i.test(titleLower) || /previously/i.test(titleLower)) return 'recap';
  if (/preview/i.test(titleLower) || /next episode/i.test(titleLower)) return 'preview';
  
  return 'chapter';
}
```

---

## 7. Transcoding Engine Architecture

### 7.1 Flow Overview

```
Playback Request
      │
      ▼
┌─────────────┐
│   Media     │ ──── Is media scanned? ────▶ No: Inline scan
│   Lookup    │
└─────────────┘
      │ Yes
      ▼
┌─────────────┐
│  Decision   │ ──── Can direct play? ────▶ Stream directly
│   Engine    │
└─────────────┘
      │ No
      ▼
┌─────────────┐
│  Playback   │ ──── Check hierarchy: Remux → Remux-HLS → Transcode
│  Hierarchy  │
└─────────────┘
      │
      ▼
┌─────────────┐
│   Quirks    │ ──── Apply deinterlace, VFR fix, etc.
│   Handler   │
└─────────────┘
      │
      ▼
┌─────────────┐
│  Profile    │ ──── Select best profile
│  Selector   │
└─────────────┘
      │
      ▼
┌─────────────┐
│  FFmpeg     │ ──── Generate command
│  Builder    │
└─────────────┘
      │
      ▼
┌─────────────┐
│  Process    │ ──── Spawn, monitor, handle errors
│  Manager    │
└─────────────┘
      │
      ▼
┌─────────────┐
│  Segment    │ ──── Watch for segments, update playlists
│  Watcher    │
└─────────────┘
```

### 7.2 Admission Control & Queue Policy

```typescript
interface AdmissionPolicy {
  maxConcurrent: number;
  maxQueueDepth: 20;
  priorityLevels: {
    interactive: 100,
    prefetch: 50,
    trickplay: 30,
    background: 10,
  };
}

const QUEUE_POLICY = {
  interactiveTimeout: 10_000,
  prefetchTimeout: 30_000,
  trickplayTimeout: 600_000,
  backgroundTimeout: 300_000,
  starvationProtection: true,
};
```

---

## 8. HLS Correctness Contracts

### 8.1 Segment Container Format

| Condition | Format | Rationale |
|-----------|--------|-----------|
| Default | TS (`.ts`) | Widest compatibility |
| fMP4 required | fMP4 (`.m4s`) | Only if client requests via `_HLS_msn` |
| HEVC passthrough | fMP4 | Better HEVC support in fMP4 |

### 8.2 Playlist Semantics

```
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:EVENT

... segments ...

#EXT-X-ENDLIST
```

| State | Playlist Type | ENDLIST |
|-------|---------------|---------|
| Transcoding in progress | `EVENT` | Absent |
| Transcode complete | `EVENT` | Present |
| Cached/pre-transcoded | `VOD` | Present |

### 8.3 Epoch & Discontinuity Model

**Discontinuity triggers (new epoch required):**

| Event | Action |
|-------|--------|
| FFmpeg restart (crash recovery) | `#EXT-X-DISCONTINUITY` |
| Seek to non-transcoded region | New epoch, discontinuity |
| Quality/profile change | New epoch, discontinuity |
| Audio track switch (if muxed) | New epoch, discontinuity |
| Subtitle burn-in toggle | New epoch, discontinuity |
| HDR/tone-map mode change | New epoch, discontinuity |
| Playback speed change | New epoch, discontinuity |

### 8.4 Keyframe Alignment for ABR

```bash
-g 96 \
-keyint_min 96 \
-sc_threshold 0 \
-force_key_frames "expr:gte(t,n_forced*4)"
```

---

## 9. Live Transcoding & Seek Behavior

### 9.1 Instant Playback Timeline

```
T+0.0s   User presses Play → Client sends request
T+0.3s   Server creates session → Profile selected, cache checked
T+0.5s   FFmpeg spawned → Begins transcoding first segment
T+2-4s   First segment ready (4 seconds) → Playlist updated
T+3-5s   Playback begins → Server continues transcoding ahead
T+5s+    Lookahead buffer builds → Stay 30-60s ahead
```

### 9.2 Resume Position Contract

**Resume time is always stored in source-file time, not segment time.**

```typescript
interface PlaybackPosition {
  mediaId: string;
  userId: string;
  sourceTimeSeconds: number;
  totalDuration: number;
  updatedAt: Date;
  playbackSpeed: number;
}

const RESUME_TOLERANCE = 2;  // ±2 seconds acceptable drift
```

### 9.3 Seek Handling

```typescript
async function handleSeek(sessionId: string, targetTime: number): Promise<SeekResponse> {
  const session = getSession(sessionId);
  const targetSegment = Math.floor(targetTime / SEGMENT_DURATION);
  
  if (session.segments.ready.includes(targetSegment)) {
    return { status: 'ready', segmentIndex: targetSegment };
  }
  
  return await seekWithTimeout(session, targetTime);
}
```

---

## 10. Audio Track & Subtitle Switching

### 10.1 Audio Group Strategy

| Scenario | Strategy | Rationale |
|----------|----------|-----------|
| Single audio track | Muxed with video | Simpler, no sync issues |
| Multiple tracks, all AAC-compatible | Separate audio groups | Instant switching |
| Multiple tracks, some need transcode | Separate groups, transcode as needed | Flexibility |
| Low-end client | Muxed, single track | Fewer requests |

### 10.2 Audio Codec Decision Matrix

| Source Codec | Client AAC | Client AC3 | Client EAC3 | Action |
|--------------|------------|------------|-------------|--------|
| AAC | ✅ | - | - | Passthrough |
| AC3 | ❌ | ✅ | - | Passthrough |
| AC3 | ❌ | ❌ | - | Transcode → AAC |
| EAC3 | ❌ | - | ✅ | Passthrough |
| TrueHD | ❌ | ✅ | - | Transcode → AC3 5.1 |
| TrueHD | ❌ | ❌ | - | Transcode → AAC stereo |
| DTS | ❌ | ✅ | - | Transcode → AC3 |
| DTS | ❌ | ❌ | - | Transcode → AAC |

### 10.3 Subtitle Handling

| Format | Type | Render Method | Track Switching |
|--------|------|---------------|-----------------|
| WebVTT/SRT | Text | Client-side | ✅ Instant |
| ASS/SSA simple | Text | Convert to WebVTT | ✅ Instant |
| ASS/SSA complex | Text | Burn into video | ❌ New epoch |
| PGS/VOBSUB | Image | Burn into video | ❌ New epoch |

---

## 11. HDR Handling

### 11.1 HDR Format Detection

| HDR Type | Detection | Pass Through | Tone Map |
|----------|-----------|--------------|----------|
| HDR10 | color_transfer = smpte2084 | If client supports | zscale + tonemap |
| HDR10+ | Dynamic metadata present | If client supports | Strip to HDR10 or tonemap |
| Dolby Vision Profile 5 | Codec contains "dvhe", profile=5 | Only DV-capable clients | Convert to HDR10 or tonemap |
| Dolby Vision Profile 7 | Codec contains "dvhe", profile=7 | Only DV-capable clients | **Cannot fallback** - must transcode |
| Dolby Vision Profile 8 | Codec contains "dvhe", profile=8 | DV clients or HDR10 fallback | HDR10 base layer or tonemap |
| HLG | color_transfer = arib-std-b67 | If client supports | Tonemap |

### 11.2 Dolby Vision Handling

```typescript
function getDVPlaybackStrategy(dv: DolbyVisionInfo, client: ClientCapabilities): DVStrategy {
  if (client.hdr.dolbyVision && client.hdr[`dvProfile${dv.profile}`]) {
    return { mode: 'passthrough' };
  }
  
  if (dv.profile === 8 && dv.hasHDR10BaseLayer && client.hdr.hdr10) {
    return { mode: 'extract_hdr10_base' };
  }
  
  if ((dv.profile === 5 || dv.profile === 8) && client.hdr.hdr10) {
    return { mode: 'convert_to_hdr10' };
  }
  
  if (dv.profile === 7) {
    return { mode: 'tonemap_to_sdr', reason: 'DV_PROFILE_7_NO_FALLBACK' };
  }
  
  return { mode: 'tonemap_to_sdr' };
}
```

### 11.3 Tone Mapping Filters

```bash
# Software (CPU) - HDR10 to SDR
-vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"

# NVIDIA (GPU) - HDR10 to SDR
-vf "tonemap_cuda=tonemap=hable:desat=0:format=yuv420p"
```

---

## 12. Content Quirks Handling

### 12.1 Interlaced Content

#### Detection

```typescript
async function detectInterlacing(filePath: string): Promise<InterlaceInfo> {
  const result = await exec(`ffmpeg -i "${filePath}" -vf "idet" -frames:v 500 -f null - 2>&1`);
  
  const tff = parseInt(result.match(/TFF:\s*(\d+)/)?.[1] || '0');
  const bff = parseInt(result.match(/BFF:\s*(\d+)/)?.[1] || '0');
  const progressive = parseInt(result.match(/Progressive:\s*(\d+)/)?.[1] || '0');
  
  const total = tff + bff + progressive;
  const interlacedRatio = (tff + bff) / total;
  
  return {
    isInterlaced: interlacedRatio > 0.5,
    fieldOrder: tff > bff ? 'tt' : 'bb',
    confidence: interlacedRatio > 0.8 ? 'high' : 'medium',
  };
}
```

#### Deinterlacing Filters

| Filter | Quality | Speed | Use Case |
|--------|---------|-------|----------|
| `yadif` | Good | Fast | Default, real-time |
| `bwdif` | Better | Medium | Higher quality, more CPU |
| `w3fdif` | Best | Slow | Offline/pre-transcode only |
| `yadif_cuda` | Good | Fast | GPU-accelerated |

```bash
# Default deinterlacing
-vf "yadif=0:-1:0"

# NVIDIA GPU deinterlacing
-vf "yadif_cuda=0:-1:0"
```

### 12.2 Variable Frame Rate (VFR)

```bash
# Convert VFR to CFR
-vsync cfr -r 29.97
```

### 12.3 Telecined Content (3:2 Pulldown)

```bash
# Inverse telecine
-vf "fieldmatch,decimate"
```

### 12.4 Legacy Container Handling

| Container | Issues | Handling |
|-----------|--------|----------|
| AVI | No streaming support | Always remux to MP4/MKV |
| WMV/ASF | DRM issues, poor seek | Remux or transcode |
| RMVB | Proprietary | Full transcode required |
| FLV | Flash-era | Remux to MP4 |
| VOB (DVD) | Multiple angles | Extract main title, remux |
| M2TS (Blu-ray) | Complex structure | Remux to MKV |

### 12.5 Aspect Ratio Handling

```typescript
function getScalingFilter(source: AspectRatioInfo, target: { width: number; height: number }): string {
  const filters: string[] = [];
  
  filters.push(`scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease`);
  filters.push(`pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2`);
  
  return filters.join(',');
}
```

---

## 13. Trickplay & Seek Preview

### 13.1 Overview

Trickplay provides thumbnail previews during seeking, showing users a visual preview of where they're scrubbing to.

### 13.2 Formats

#### WebVTT Thumbnails (Web/Mobile)

```
WEBVTT

00:00:00.000 --> 00:00:10.000
thumbnails/thumb_0001.jpg#xywh=0,0,320,180

00:00:10.000 --> 00:00:20.000
thumbnails/thumb_0001.jpg#xywh=320,0,320,180
```

#### BIF Format (Roku/Fire TV)

Binary format with JPEG frames at fixed intervals.

### 13.3 Generation Pipeline

```typescript
interface TrickplayConfig {
  interval: number;           // seconds between thumbnails (default: 10)
  width: number;              // thumbnail width (default: 320)
  height: number;             // computed from aspect ratio
  spriteColumns: number;      // thumbnails per row (default: 5)
  spriteRows: number;         // rows per sprite (default: 5)
  quality: number;            // JPEG quality (default: 75)
  formats: ('webvtt' | 'bif')[];
}
```

### 13.4 FFmpeg Thumbnail Extraction

```bash
# Extract thumbnails at 10-second intervals
ffmpeg -i input.mkv \
  -vf "fps=1/10,scale=320:-1" \
  -q:v 5 \
  thumbnails/thumb_%04d.jpg

# With hardware acceleration
ffmpeg -hwaccel cuda -i input.mkv \
  -vf "fps=1/10,scale_cuda=320:-1" \
  -q:v 5 \
  thumbnails/thumb_%04d.jpg
```

---

## 14. User Experience Features

### 14.1 Playback Speed Control

| Speed | Use Case | Audio Handling |
|-------|----------|----------------|
| 0.5x | Learning content | Pitch preserved |
| 0.75x | Detailed viewing | Pitch preserved |
| 1.0x | Normal | Normal |
| 1.25x | Efficient watching | Pitch preserved |
| 1.5x | Quick review | Pitch preserved |
| 2.0x | Skimming | Pitch preserved |

```bash
# 1.5x speed with pitch-preserved audio
ffmpeg -i input.mkv \
  -vf "setpts=0.667*PTS" \
  -af "atempo=1.5" \
  output.mp4
```

### 14.2 Audio Normalization

```bash
# EBU R128 loudness normalization
ffmpeg -i input.mkv \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
  -c:v copy -c:a aac output.mp4

# Night mode (dynamic range compression)
ffmpeg -i input.mkv \
  -af "compand=attacks=0:points=-80/-80|-45/-15|-27/-9|0/-7|20/-7" \
  -c:v copy -c:a aac output.mp4
```

### 14.3 Intro/Credits Skip

```typescript
interface SkipMarker {
  mediaId: string;
  type: 'intro' | 'credits' | 'recap' | 'preview';
  startTime: number;
  endTime: number;
  source: 'chapter' | 'manual' | 'auto_detected';
  confidence: number;
}

interface SkipPreferences {
  introSkip: 'off' | 'prompt' | 'auto';
  creditsSkip: 'off' | 'prompt' | 'auto';
  recapSkip: 'off' | 'prompt' | 'auto';
}
```

### 14.4 Language Preferences

```typescript
interface UserLanguagePreferences {
  userId: string;
  preferredAudioLanguages: string[];  // ['jpn', 'eng']
  preferOriginalLanguage: boolean;
  preferSurroundSound: boolean;
  avoidDubbedAudio: boolean;
  preferredSubtitleLanguages: string[];
  subtitleMode: 'off' | 'auto' | 'always' | 'foreign_only';
  preferSDH: boolean;
  preferForcedOnly: boolean;
  fallbackAudioLanguage: string;
  fallbackSubtitleLanguage: string;
}
```

### 14.5 Watch History

```typescript
interface WatchHistoryEntry {
  id: string;
  userId: string;
  mediaId: string;
  positionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  completed: boolean;
  watchedAt: Date;
  deviceId: string;
  playbackSpeed: number;
  audioTrack: number;
  subtitleTrack: number | null;
}

const WATCH_HISTORY_POLICY = {
  markCompletedThreshold: 0.90,
  resumeThreshold: 0.05,
  resumeFromEndThreshold: 0.95,
  historyRetentionDays: 365,
};
```

---

## 15. Error Recovery & Resilience

### 15.1 Error Types

| Type | Cause | Retryable | Action |
|------|-------|-----------|--------|
| encoder_failure | HW encoder init failed | Yes | Software fallback |
| input_error | Can't read source | No | Abort with message |
| output_error | Disk full | Yes | Clean cache, reduce quality |
| resource_exhaustion | Out of memory | Yes | Reduce quality |
| ffmpeg_crash | Unknown crash | Yes | Retry 1-2 times |
| quirk_handling_failure | Deinterlace/VFR fix failed | Yes | Skip quirk handling |

### 15.2 Timeout Policy

| Timeout | Value | Action on Breach |
|---------|-------|------------------|
| First segment deadline | 10s | Restart with lower quality |
| No-progress timeout | 30s | Kill FFmpeg, retry |
| Total session timeout | 4h | Terminate, log |
| Seek segment timeout | 15s | Return error to client |
| Media scan timeout | 120s | Mark failed, queue retry |
| Trickplay generation timeout | 600s | Mark failed, retry |

### 15.3 Restart Budget

```typescript
const RESTART_POLICY = {
  maxRestartsPerSession: 3,
  backoffMs: [1000, 3000, 10000],
  resetAfterSuccessMs: 60_000,
};
```

### 15.4 Poison Media Policy

```typescript
interface MediaHealth {
  mediaId: string;
  failureCount: number;
  lastFailure: Date;
  failureReasons: string[];
  status: 'healthy' | 'suspect' | 'poison';
}

const POISON_POLICY = {
  failureThreshold: 3,
  poisonThreshold: 5,
  decayPeriodDays: 7,
};
```

---

## 16. Caching Strategy

### 16.1 Cache Structure

```
/data/transcode-cache/
├─ {cacheKey}/
│   ├─ video/segment_00000.ts ...
│   ├─ audio_0/segment_00000.ts ...
│   ├─ master.m3u8
│   └─ .meta.json
├─ trickplay/
│   └─ {mediaId}/
│       ├─ thumbnails.vtt
│       ├─ thumbnails.bif
│       └─ sprite_0000.jpg ...
```

### 16.2 Versioned Cache Key

```typescript
interface CacheKeyComponents {
  sourceFingerprint: string;
  pipelineSchemaVersion: number;
  ffmpegMajorVersion: number;
  encoderId: string;
  profileId: string;
  settingsHash: string;
  audioTrackIndex: number;
  subtitleMode: 'none' | 'sidecar' | 'burn_idx_N';
  hdrMode: 'passthrough' | 'tonemap_hable' | 'tonemap_reinhard';
  quirksApplied: string[];
  playbackSpeed: number;
  audioNormalization: boolean;
}
```

### 16.3 Eviction Policy

| Rule | Details |
|------|---------|
| LRU | Delete least recently accessed first |
| Max Size | Default 50GB |
| Active Protection | **Never evict currently playing sessions** |
| Age Limit | Delete after 7 days unused |
| Emergency | Clear oldest when disk < 5GB |
| Trickplay Priority | Evict trickplay before transcodes |

---

## 17. Security Considerations

### 17.1 Path Traversal Prevention

```typescript
function validatePath(sessionId: string, filename: string): string {
  if (!SESSION_ID_REGEX.test(sessionId)) throw new Error('Invalid session');
  
  const fullPath = path.join(CACHE_DIR, sessionId, filename);
  const resolved = path.resolve(fullPath);
  
  if (!resolved.startsWith(path.resolve(CACHE_DIR))) {
    throw new Error('Path traversal attempt');
  }
  return resolved;
}
```

### 17.2 Signed URL Contract

```typescript
interface SignedURLPayload {
  sessionId: string;
  userId: string;
  mediaId: string;
  exp: number;
  iat: number;
  scope: 'playlist' | 'segment' | 'full';
}

const SIGNED_URL_POLICY = {
  playlistTTL: 3600,
  segmentTTL: 300,
  refreshWindow: 60,
  algorithm: 'HS256',
};
```

### 17.3 Rate Limiting

| Limit | Value |
|-------|-------|
| Max sessions per user | 3 |
| Max new sessions/minute | 5 |
| Max total transcodes | Server capacity |
| Max API requests/minute | 100 |

---

## 18. Bandwidth Measurement & Adaptation

### 18.1 Adaptation Strategy

| Buffer Health | Action |
|---------------|--------|
| > 30s | Try upgrading quality |
| 10-30s | Maintain current |
| 5-10s | Downgrade quality |
| < 5s | Emergency: lowest + smaller segments |

---

## 19. Offline Downloads Support

### 19.1 Download Flow

1. User requests download
2. Select quality tier
3. Queue transcode (lower priority)
4. Generate complete MP4 file
5. Store record in database
6. Start expiration timer (30 days)

### 19.2 Format

- Single MP4 file (not HLS)
- H.264 + AAC for compatibility
- Optional encryption (AES-128)

---

## 20. Multi-Version Media Handling

### 20.1 Version Types

| Version Type | Example | Selection Criteria |
|--------------|---------|-------------------|
| Quality | 1080p vs 4K | Client capability, bandwidth |
| Cut | Theatrical vs Extended | User preference |
| Edition | Original vs Remaster | User preference |
| 3D | 2D vs 3D | Device capability |

### 20.2 Version Grouping

```typescript
interface MediaVersionGroup {
  groupId: string;
  primaryMediaId: string;
  versions: MediaVersion[];
}

interface MediaVersion {
  mediaId: string;
  versionType: 'quality' | 'cut' | 'edition' | '3d';
  label: string;
  resolution: string;
  hdrFormat?: string;
  runtime?: number;
  isDefault: boolean;
  priority: number;
}
```

---

## 21. Monitoring & Observability

### 21.1 Key Metrics

```
transcode_sessions_active           gauge
transcode_queue_depth               gauge
transcode_speed_ratio               histogram
transcode_errors_total              counter
cache_size_bytes                    gauge
cache_hit_rate                      gauge
direct_play_rate                    gauge
playback_start_latency_seconds      histogram
scan_queue_depth                    gauge
trickplay_coverage_ratio            gauge
```

### 21.2 Alerting Thresholds

| Condition | Severity |
|-----------|----------|
| Queue > 10 for 5min | Warning |
| Error rate > 5% in 15min | Critical |
| Disk < 10GB | Critical |
| Encode speed < 0.8x | Warning |
| Playback start latency p95 > 10s | Warning |

### 21.3 Structured Decision Logs

```typescript
interface PlaybackDecisionLog {
  timestamp: string;
  sessionId: string;
  userId: string;
  mediaId: string;
  decision: 'direct_play' | 'remux' | 'remux_hls' | 'transcode_hls';
  reasonCode: PlaybackReasonCode;
  clientType: string;
  networkType: 'lan' | 'remote';
  sourceCodec: string;
  targetCodec: string;
  profile: string;
  quirksApplied: string[];
  decisionLatencyMs: number;
}

type PlaybackReasonCode =
  | 'CLIENT_SUPPORTS_SOURCE'
  | 'CONTAINER_INCOMPATIBLE'
  | 'RANGE_UNRELIABLE'
  | 'KEYFRAMES_SPARSE'
  | 'CODEC_UNSUPPORTED'
  | 'HDR_TONEMAP_REQUIRED'
  | 'DV_PROFILE_INCOMPATIBLE'
  | 'RESOLUTION_DOWNSCALE'
  | 'BITRATE_CONSTRAINED'
  | 'BURN_IN_SUBTITLES'
  | 'DEINTERLACE_REQUIRED'
  | 'VFR_CONVERSION_REQUIRED'
  | 'SPEED_CHANGE_ACTIVE'
  | 'FORCED_FALLBACK';
```

---

## 22. Operational Concerns

### 22.1 Graceful Shutdown

```typescript
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, initiating graceful shutdown`);
  
  // 1. Stop accepting new requests
  server.close();
  
  // 2. Stop accepting new transcode jobs
  transcodeQueue.pause();
  
  // 3. Save session state for resume
  const activeSessions = await getActiveSessions();
  for (const session of activeSessions) {
    await saveSessionState(session.id, {
      mediaId: session.mediaId,
      position: session.currentSourceTime,
      profile: session.profile,
    });
  }
  
  // 4. Wait for active transcodes (with timeout)
  await waitForDrain(30_000);
  
  // 5. Force kill remaining
  await killRemainingTranscodes();
  
  // 6. Close database
  await database.close();
  
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### 22.2 Database Migrations

```typescript
interface Migration {
  version: number;
  name: string;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
}

async function runMigrations(db: Database): Promise<void> {
  const currentVersion = await getCurrentSchemaVersion(db);
  
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      await db.exec('BEGIN TRANSACTION');
      try {
        await migration.up(db);
        await db.run('INSERT INTO schema_version (version) VALUES (?)', migration.version);
        await db.exec('COMMIT');
      } catch (error) {
        await db.exec('ROLLBACK');
        throw error;
      }
    }
  }
}
```

### 22.3 Health Checks

```typescript
const healthChecks: HealthCheck[] = [
  { name: 'database', critical: true, check: checkDatabase },
  { name: 'ffmpeg', critical: true, check: checkFFmpeg },
  { name: 'disk_space', critical: true, check: checkDiskSpace },
  { name: 'transcode_queue', critical: false, check: checkQueueDepth },
];

// Endpoints:
// GET /health         - Simple up/down
// GET /health/ready   - Ready to serve
// GET /health/live    - Detailed health
```

---

## 23. API Versioning & Client Contract

### 23.1 Version Strategy

```typescript
// URL-based versioning: /api/v1/media/{id}, /api/v2/media/{id}

interface ServerCapabilitiesResponse {
  serverVersion: string;
  apiVersion: number;
  supportedApiVersions: number[];
  capabilities: {
    transcoding: boolean;
    hardwareAcceleration: boolean;
    maxConcurrentStreams: number;
    supportedVideoCodecs: string[];
    supportedAudioCodecs: string[];
    hdrSupport: string[];
    trickplayFormats: string[];
    supportsOfflineDownloads: boolean;
    supportsPlaybackSpeed: boolean;
    supportsAudioNormalization: boolean;
  };
  features: {
    introSkipDetection: boolean;
    multiVersionMedia: boolean;
    watchTogether: boolean;
  };
}
```

### 23.2 Breaking Change Policy

| Change Type | Handling |
|-------------|----------|
| New optional field | Add to response, no version bump |
| New required field | New API version |
| Field removal | Deprecate first, remove in next major |
| Behavior change | Document, consider feature flag |

---

## 24. Testing Strategy

### 24.1 Unit Tests

```typescript
describe('FFmpegCommandBuilder', () => {
  it('builds correct software command', () => {
    const cmd = buildFFmpegCommand({ encoder: 'libx264' });
    expect(cmd).toContain('-c:v libx264');
  });
  
  it('includes deinterlace filter for interlaced content', () => {
    const cmd = buildFFmpegCommand({ quirks: { isInterlaced: true } });
    expect(cmd).toContain('yadif');
  });
});
```

### 24.2 Compatibility Matrix

| Source | Client | Expected |
|--------|--------|----------|
| H.264 1080p | Safari iOS | Direct play |
| HEVC 4K | Safari iOS | Direct play |
| AV1 | Safari | Transcode to H.264 |
| HDR10 | SDR client | Tone map |
| DV Profile 8 | HDR10 client | Extract base layer |
| DV Profile 7 | SDR client | Full transcode + tonemap |
| Interlaced MPEG2 | Any | Deinterlace + transcode |
| VFR screen recording | Any | CFR convert + transcode |
| AVI container | Any | Remux to MP4 |

---

## 25. Database Schema

### 25.1 Core Tables

```sql
CREATE TABLE server_capabilities (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  cpu_model TEXT,
  cpu_cores INTEGER,
  cpu_threads INTEGER,
  gpu_vendor TEXT,
  gpu_model TEXT,
  encoders TEXT,
  server_class TEXT,
  max_concurrent_transcodes INTEGER,
  detected_at TEXT
);

CREATE TABLE media_metadata (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  probe_data TEXT NOT NULL,
  duration_seconds REAL,
  video_codec TEXT,
  audio_codec TEXT,
  resolution TEXT,
  hdr_format TEXT,
  dolby_vision_profile INTEGER,
  is_interlaced BOOLEAN DEFAULT FALSE,
  is_variable_frame_rate BOOLEAN DEFAULT FALSE,
  content_quirks TEXT,
  has_chapters BOOLEAN DEFAULT FALSE,
  trickplay_status TEXT DEFAULT 'pending',
  scan_status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transcode_cache (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL,
  cache_key TEXT NOT NULL UNIQUE,
  profile_id TEXT NOT NULL,
  audio_track_index INTEGER DEFAULT 0,
  subtitle_mode TEXT DEFAULT 'none',
  hdr_mode TEXT DEFAULT 'passthrough',
  quirks_applied TEXT,
  playback_speed REAL DEFAULT 1.0,
  pipeline_version INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT DEFAULT 'complete',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TEXT
);

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  preferred_audio_languages TEXT,
  preferred_subtitle_languages TEXT,
  subtitle_mode TEXT DEFAULT 'auto',
  default_playback_speed REAL DEFAULT 1.0,
  audio_normalization TEXT DEFAULT 'off',
  intro_skip TEXT DEFAULT 'prompt',
  credits_skip TEXT DEFAULT 'prompt',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE watch_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  position_seconds REAL NOT NULL,
  duration_seconds REAL NOT NULL,
  progress_percent REAL NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  watched_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE skip_markers (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL,
  marker_type TEXT NOT NULL,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  source TEXT DEFAULT 'manual',
  confidence REAL DEFAULT 1.0
);

CREATE TABLE media_health (
  media_id TEXT PRIMARY KEY,
  failure_count INTEGER DEFAULT 0,
  last_failure_at TEXT,
  failure_reasons TEXT,
  status TEXT DEFAULT 'healthy'
);

CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  name TEXT,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 26. FFmpeg Command Reference

### 26.1 Universal Fallback

```bash
ffmpeg -i input.mkv \
  -c:v libx264 -preset fast -crf 23 -profile:v baseline -level 3.0 \
  -c:a aac -b:a 128k -ac 2 \
  -f hls -hls_time 4 -hls_list_size 0 \
  playlist.m3u8
```

### 26.2 NVIDIA NVENC

```bash
ffmpeg -hwaccel cuda -hwaccel_output_format cuda -i input.mkv \
  -c:v h264_nvenc -preset p4 -tune hq -rc vbr -cq 23 -b:v 10M \
  -c:a aac -b:a 384k \
  -f hls -hls_time 4 playlist.m3u8
```

### 26.3 HDR to SDR Tone Mapping

```bash
ffmpeg -i hdr.mkv \
  -vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p" \
  -c:v libx264 -crf 18 -c:a aac output.mp4
```

### 26.4 Deinterlacing

```bash
ffmpeg -i interlaced.mkv -vf "yadif=0:0:0" -c:v libx264 output.mp4
```

### 26.5 VFR to CFR

```bash
ffmpeg -i vfr.mp4 -vsync cfr -r 30 -c:v libx264 output.mp4
```

### 26.6 Playback Speed

```bash
ffmpeg -i input.mkv -vf "setpts=0.667*PTS" -af "atempo=1.5" output.mp4
```

### 26.7 Audio Normalization

```bash
ffmpeg -i input.mkv -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:v copy output.mp4
```

### 26.8 Subtitle Burn-In

```bash
ffmpeg -i input.mkv -vf "subtitles='input.mkv':si=0" -c:v libx264 output.mp4
```

### 26.9 Trickplay Thumbnails

```bash
ffmpeg -i input.mkv -vf "fps=1/10,scale=320:-1" -q:v 5 thumb_%04d.jpg
```

---

## 27. Implementation Phases

| Phase | Focus | Duration |
|-------|-------|----------|
| 1 | Foundation | Week 1-2 |
| 2 | Basic Transcoding | Week 3-4 |
| 3 | Hardware Acceleration | Week 5-6 |
| 4 | Content Quirks | Week 7-8 |
| 5 | Multi-Quality ABR | Week 9-10 |
| 6 | Live Transcoding | Week 11-12 |
| 7 | Track Switching | Week 13-14 |
| 8 | Trickplay | Week 15-16 |
| 9 | UX Features | Week 17-18 |
| 10 | Caching & Remote | Week 19-20 |
| 11 | Multi-Version | Week 21-22 |
| 12 | HDR & DV | Week 23-24 |
| 13 | Offline Downloads | Week 25-26 |
| 14 | Hardening | Week 27-28 |
| 15 | Observability | Week 29-30 |
| 16 | Polish & Launch | Week 31-32 |

---

## 28. Future Scope

### 28.1 Watch Together (Sync Playback)

- WebSocket for real-time sync
- Latency compensation
- Buffer synchronization
- Chat/reactions overlay

### 28.2 External Player Support

| Protocol | Use Case |
|----------|----------|
| DLNA/UPnP | Smart TVs, receivers |
| Chromecast | Google ecosystem |
| AirPlay | Apple ecosystem |
| External player intent | VLC, mpv |

### 28.3 Multi-Server Load Balancing

- Shared database or distributed state
- Cache sharing/replication
- Session migration on failover

### 28.4 AI-Powered Features

- Audio fingerprinting for intro detection
- Automatic chapter generation
- Content-based recommendations
- Smart thumbnail selection

---

## Summary

This pipeline is designed to:

1. **Adapt to any server** - Raspberry Pi to enterprise
2. **Play on any device** - H.264/AAC fallback guarantees compatibility
3. **Handle any content** - Interlaced, VFR, HDR, Dolby Vision, legacy containers
4. **Start instantly** - 3-5 second startup
5. **Recover gracefully** - Handle errors and resource constraints
6. **Scale efficiently** - Caching, sharing, pre-transcoding
7. **Optimize for remote** - Bandwidth-aware quality
8. **Provide rich UX** - Trickplay, speed control, intro skip, language preferences

**Key insight: The best playback experience is invisible.** Users press play, it plays.

---

## Changelog

### Version 3.0 - Comprehensive Update

| Section | Change |
|---------|--------|
| §6 | **NEW** - Media Analysis & Metadata (ffprobe workflow, chapter extraction, scan pipeline) |
| §11.2 | **EXPANDED** - Dolby Vision profile handling (P5/P7/P8 differences) |
| §12 | **NEW** - Content Quirks Handling (interlacing, VFR, telecine, legacy containers, aspect ratio) |
| §13 | **NEW** - Trickplay & Seek Preview (WebVTT, BIF, sprite generation) |
| §14 | **NEW** - User Experience Features (playback speed, audio normalization, intro skip, language prefs, watch history) |
| §20 | **NEW** - Multi-Version Media Handling |
| §22 | **NEW** - Operational Concerns (graceful shutdown, migrations, backups, health checks) |
| §23 | **NEW** - API Versioning & Client Contract |
| §28 | **NEW** - Future Scope (watch together, external players, multi-server, AI features) |
| All | Updated TypeScript interfaces and database schema to support new features |