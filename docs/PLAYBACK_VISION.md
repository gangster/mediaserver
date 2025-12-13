# Playback Vision & Architecture

> **Mission**: Deliver a premium playback experience for every user—local or remote, newbie or power user—regardless of their hardware, network, or technical expertise.

---

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [The User Spectrum](#the-user-spectrum)
3. [Hardware & Disk Space Realities](#hardware--disk-space-realities)
4. [UX Approach: Layers of Control](#ux-approach-layers-of-control)
5. [Remote Sharing Vision](#remote-sharing-vision)
6. [Technical Architecture](#technical-architecture)
7. [Playback Decision Logic](#playback-decision-logic)
8. [Transcoding Strategy](#transcoding-strategy)
9. [Competitive Differentiation](#competitive-differentiation)
10. [Implementation Phases](#implementation-phases)

---

## Core Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     "It should feel like Netflix, but with the power of        │
│      Plex available when you want it."                          │
│                                                                 │
│     Grandma clicks play → it plays                              │
│     Power user clicks play → it plays the way THEY want it to   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Guiding Principles

1. **Premium by Default** - Every user gets a great experience out of the box
2. **Progressive Disclosure** - Complexity is available but never forced
3. **Adaptive Intelligence** - System learns and optimizes automatically
4. **Honest Communication** - Clear feedback about what's happening and why
5. **Graceful Degradation** - Always playable, even if not optimal
6. **Remote = Local** - Remote users get the same premium experience

---

## The User Spectrum

```
NEWB ◀──────────────────────────────────────────────▶ POWER USER

"I just want to       "I understand         "I want to control
watch my movies"      some of this"         every bit"

     │                      │                      │
     ▼                      ▼                      ▼

┌──────────┐          ┌──────────┐          ┌──────────┐
│ Auto     │          │ Presets  │          │ Custom   │
│ Everything│         │ + Tweaks │          │ Everything│
└──────────┘          └──────────┘          └──────────┘

• Press play         • Quality selector    • Force direct play
• System decides     • "Optimize for       • Custom bitrate
• Clear feedback       my TV" preset       • HW accel config
  if issues          • Save preferences    • Pre-transcode rules
                       per device          • Debug stats overlay
```

### What Each User Type Needs

| User Type | Primary Need | Our Response |
|-----------|--------------|--------------|
| **Newbie** | "Just work" | Smart defaults, zero config |
| **Casual** | "Some control" | Simple quality picker, presets |
| **Enthusiast** | "My preferences" | Per-device settings, quality tiers |
| **Power User** | "Full control" | Advanced settings, stats, overrides |

---

## Hardware & Disk Space Realities

### Server Hardware Spectrum

```
USER'S SERVER                    WHAT WE MUST DO
─────────────────────────────────────────────────────────────────

Raspberry Pi 4                   • Direct play or bust
(No transcode capability)        • Help them understand file formats
                                 • Suggest pre-transcoded downloads
                                 • "Your server can't convert this"

Old NAS / Weak CPU               • Limited transcoding (1 stream max)
(Synology DS218, etc.)           • Prioritize efficiency over quality
                                 • Smart scheduling
                                 • "Converting... this may take a moment"

Mid-range PC                     • Software transcoding works
(i5, no GPU)                     • 1-2 simultaneous streams
                                 • Good experience most of the time

Gaming PC / Server               • Hardware acceleration
(NVIDIA GPU / Intel QSV)         • Multiple simultaneous transcodes
                                 • Pre-transcoding options
                                 • Premium experience

Dedicated Server                 • Everything, all the time
(Xeon + GPU)                     • Pre-transcode entire library
                                 • 10+ simultaneous streams
```

### Disk Space Strategy

```
AVAILABLE SPACE          STRATEGY
─────────────────────────────────────────────────────────────────

Tight (<500GB free)      • On-the-fly transcoding only
                         • No caching
                         • Clear messaging about limitations

Moderate (500GB-2TB)     • Cache recent transcodes (auto-cleanup)
                         • Optimize most-watched content
                         • User can pin favorites

Abundant (2TB+)          • Pre-transcode popular content
                         • Multiple quality versions
                         • "Optimize Library" feature

Unlimited (10TB+)        • Full optimization
                         • 4K + 1080p + 720p versions
                         • Instant playback everywhere
```

---

## UX Approach: Layers of Control

### Layer 0: It Just Works (Default)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ▶ Play Movie                                                   │
│                                                                 │
│  [User clicks, movie plays, they're happy]                      │
│                                                                 │
│  Behind the scenes:                                             │
│  • Detected client: Safari on MacBook                           │
│  • Detected bandwidth: ~25 Mbps                                 │
│  • File: 4K HEVC HDR → Auto-selected 1080p H.264               │
│  • User sees: Nothing. It just works.                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Layer 1: Simple Choices (One Click Away)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Quality: Auto (1080p) ▾                                        │
│  ┌─────────────────────────────────────────────┐                │
│  │  ✓ Auto (Recommended)                       │                │
│  │    Best quality for your connection          │                │
│  │                                              │                │
│  │  ○ Maximum Quality                           │                │
│  │    4K HDR if available                       │                │
│  │                                              │                │
│  │  ○ Save Bandwidth                            │                │
│  │    Lower quality, less data                  │                │
│  └─────────────────────────────────────────────┘                │
│                                                                 │
│  Subtitles: English ▾    Audio: English (5.1) ▾                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Layer 2: Preferences (Settings Page)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  PLAYBACK PREFERENCES                                           │
│                                                                 │
│  ┌─ This Device ─────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Preferred Quality                                        │  │
│  │  [Auto] [Maximum] [1080p] [720p] [Mobile]                │  │
│  │                                                           │  │
│  │  When Original Can't Play                                 │  │
│  │  [Convert automatically] [Ask me] [Try anyway]           │  │
│  │                                                           │  │
│  │  Audio                                                    │  │
│  │  Surround sound: [When available] [Always stereo]        │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ All Devices ─────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Language preferences    [English, Spanish]              │  │
│  │  Subtitle preferences    [Auto for foreign audio]        │  │
│  │  Skip intros            [Always]                         │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Layer 3: Power User Controls (Admin/Advanced)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  SERVER TRANSCODING SETTINGS                     [Admin Only]   │
│                                                                 │
│  ┌─ Hardware Acceleration ───────────────────────────────────┐  │
│  │                                                           │  │
│  │  Detected: NVIDIA GeForce RTX 3080                       │  │
│  │  Status: ✅ NVENC available                               │  │
│  │                                                           │  │
│  │  [✓] Use hardware acceleration when available            │  │
│  │  [ ] Prefer quality over speed                           │  │
│  │                                                           │  │
│  │  Max simultaneous transcodes: [4] (GPU memory limited)   │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Pre-Transcoding ─────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  [ ] Optimize library for playback                       │  │
│  │      Create 1080p versions of 4K content                 │  │
│  │      Est. additional space: ~450 GB                      │  │
│  │                                                           │  │
│  │  Schedule: [Overnight only] [Anytime] [Manual]           │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Advanced ────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Transcoding profiles: [Edit...]                         │  │
│  │  Segment duration: [4 seconds]                           │  │
│  │  Temporary files: /var/transcode (124 GB free)           │  │
│  │  [View active sessions] [View transcode logs]            │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Remote Sharing Vision

### The Goal

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  YOUR MEDIA SERVER                                              │
│  ┌─────────────────┐                                            │
│  │ 🏠 Home Server  │                                            │
│  │                 │                                            │
│  │  Movies: 500    │                                            │
│  │  Shows: 120     │                                            │
│  │  Music: 10,000  │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ├──────────── 👨 You (at home) - Direct, full quality │
│           │                                                     │
│           ├──────────── 👩 Partner (at work) - Remote, optimized│
│           │                                                     │
│           ├──────────── 👴 Parents (another state) - Remote     │
│           │                                                     │
│           ├──────────── 👧 Kids (at college) - Remote           │
│           │                                                     │
│           └──────────── 🧑‍🤝‍🧑 Friends - Limited library access    │
│                                                                 │
│  Everyone gets a premium experience.                            │
│  No one needs to understand networking.                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The Problem Today

```
PLEX APPROACH:
├── Easy: Use Plex relay (paid, goes through their servers)
├── Hard: Port forward yourself (technical, security risk)
└── Result: Pay up or struggle

JELLYFIN APPROACH:
├── Only option: Set up reverse proxy, DDNS, SSL yourself
├── Complexity: Nginx/Caddy config, Let's Encrypt, firewall rules
└── Result: Only for technical users

WHAT USERS ACTUALLY WANT:
├── "Share with Mom" → She gets an invite link, it works
├── "Watch at hotel" → Open app, sign in, it plays
└── "Friend wants to watch" → Send link, they're in
```

### Remote Access Setup

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  SHARE YOUR LIBRARY                                             │
│                                                                 │
│  Your library is ready to share! Choose how:                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🏠 HOME NETWORK ONLY                          [Current] │    │
│  │    Only devices on your WiFi can access                 │    │
│  │    Most private, no setup needed                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🌐 REMOTE ACCESS                              [Enable]  │    │
│  │    Access your library from anywhere                    │    │
│  │    Share with family and friends                        │    │
│  │                                                         │    │
│  │    ○ Automatic (recommended)                            │    │
│  │      We'll handle the networking securely               │    │
│  │                                                         │    │
│  │    ○ Custom domain                                      │    │
│  │      Use your own domain (media.yourdomain.com)        │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Inviting Someone

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  INVITE TO YOUR LIBRARY                                         │
│                                                                 │
│  Who are you inviting?                                          │
│                                                                 │
│  Name: [Mom                    ]                                │
│  Email: [mom@email.com         ]  (optional, for invite link)   │
│                                                                 │
│  What can they access?                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [✓] Movies                                              │    │
│  │ [✓] TV Shows                                            │    │
│  │ [ ] 4K Content (uses more of your bandwidth)            │    │
│  │ [ ] Music                                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Their experience:                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Quality: [Auto - Best for their connection    ▾]        │    │
│  │                                                         │    │
│  │ ○ Auto - System optimizes for their connection          │    │
│  │ ○ Maximum - Up to original quality (more bandwidth)     │    │
│  │ ○ Efficient - Good quality, less server load            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│            [Send Invite]                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The Invited User's Experience (Mom)

**Email:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Josh shared their media library with you!                      │
│                                                                 │
│  Click below to start watching movies and TV shows:             │
│                                                                 │
│  [Accept Invitation]                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**After clicking:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Welcome to Josh's Library!                                     │
│                                                                 │
│  Create your account to start watching:                         │
│                                                                 │
│  Name: [                    ]                                   │
│  Password: [                ]                                   │
│                                                                 │
│  [Start Watching]                                               │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Or download our app:                                           │
│  [App Store]  [Play Store]  [Apple TV]  [Fire TV]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**First play:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ▶ Playing: The Grand Budapest Hotel                            │
│                                                                 │
│  [Video plays smoothly, optimized for their connection]         │
│                                                                 │
│  Mom doesn't know or care that:                                 │
│  - The original file is 4K HDR                                  │
│  - It's being transcoded to 1080p for her iPad                  │
│  - It's traveling across the internet                           │
│  - Her son's server is doing all the work                       │
│                                                                 │
│  She just sees: Movie plays. Like Netflix.                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Connection Methods (Automatic Selection)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONNECTION STRATEGY                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. DIRECT CONNECTION (Best)                                    │
│     └─ Same network, local IP                                   │
│        Latency: <1ms, Bandwidth: Gigabit+                       │
│                                                                 │
│  2. LOCAL DISCOVERY (Good)                                      │
│     └─ Same network, discovered via mDNS/SSDP                   │
│        Latency: <1ms, Bandwidth: Network speed                  │
│                                                                 │
│  3. DIRECT REMOTE (Good, if possible)                           │
│     └─ UPnP port mapping or manual port forward                 │
│        Latency: Internet, Bandwidth: Upload speed               │
│                                                                 │
│  4. HOLE PUNCHING (Good, no config)                             │
│     └─ NAT traversal (like WebRTC)                              │
│        Latency: Internet, Bandwidth: Upload speed               │
│        Works through most NATs without port forwarding          │
│                                                                 │
│  5. RELAY SERVICE (Always works)                                │
│     └─ Traffic through our relay servers                        │
│        Latency: +20-50ms, Bandwidth: Limited by relay           │
│        Falls back to this when direct fails                     │
│        [Premium feature - part of subscription]                 │
│                                                                 │
│  System automatically tries 1→2→3→4→5 and uses best available   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Remote User Dashboard (For Server Owner)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  SHARED WITH                                           [Invite] │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 👩 Mom                                      Active now  │    │
│  │    Watching: The Crown S4E03                            │    │
│  │    Quality: 1080p (auto)  │  Bandwidth: 8 Mbps          │    │
│  │    Device: iPad Pro                                     │    │
│  │    [Manage] [Message]                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 👴 Dad                                      Last: 2d ago│    │
│  │    Last watched: NCIS S21E05                            │    │
│  │    Typical quality: 720p                                │    │
│  │    Device: Fire TV Stick                                │    │
│  │    [Manage]                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🧑‍🤝‍🧑 Jake (Friend)                          Last: 1w ago │    │
│  │    Access: Movies only (no TV)                          │    │
│  │    Expires: Never                                       │    │
│  │    [Manage] [Revoke]                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Server Status                                                  │
│  ├─ Upload bandwidth: 18/20 Mbps used                          │
│  ├─ Active transcodes: 1 of 3 max                              │
│  └─ Remote access: ✅ Connected (direct)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Smart Pre-Transcoding for Remote Users

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  OPTIMIZE FOR REMOTE USERS                                      │
│                                                                 │
│  The system learns:                                             │
│  ├─ Mom usually watches on iPad over 15 Mbps connection         │
│  ├─ She mostly watches new releases                             │
│  └─ 1080p AAC stereo is perfect for her                         │
│                                                                 │
│  So we can:                                                     │
│  ├─ Pre-transcode new movies to 1080p overnight                 │
│  ├─ Have them ready when she clicks play                        │
│  └─ Instant playback, no waiting for transcode                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Client Capability Detection

```typescript
interface ClientCapabilities {
  // Video codecs the client can decode
  videoCodecs: ('h264' | 'hevc' | 'vp9' | 'av1')[];
  
  // Video features
  hdr: boolean;
  maxResolution: '4k' | '1080p' | '720p';
  
  // Audio codecs
  audioCodecs: ('aac' | 'ac3' | 'eac3' | 'dts' | 'truehd' | 'flac' | 'opus')[];
  maxAudioChannels: number;
  
  // Container support
  containers: ('mp4' | 'webm' | 'mkv' | 'ts')[];
  
  // Streaming protocols
  protocols: ('hls' | 'dash' | 'progressive')[];
  
  // Network
  estimatedBandwidth: number;
  
  // Subtitle rendering
  subtitleFormats: ('webvtt' | 'ass' | 'srt' | 'pgs')[];
  canRenderSubtitles: boolean;
}
```

**Detection Strategy:**
- **Web**: Use `MediaCapabilities` API + known browser limitations
- **Mobile**: Native code knows capabilities
- **TV**: Platform-specific detection

### Playback Session Model

```typescript
interface PlaybackSession {
  id: string;
  userId: string;
  mediaId: string;
  
  // What we're doing
  playbackMethod: 'direct' | 'remux' | 'transcode';
  
  // Transcoding details (if applicable)
  transcodeProfile?: {
    videoCodec: string;
    videoBitrate: number;
    audioCodec: string;
    audioBitrate: number;
    audioChannels: number;
  };
  
  // Progress
  position: number;
  state: 'buffering' | 'playing' | 'paused' | 'stopped';
  
  // Resource tracking
  transcodePid?: number;
  hlsSegmentsPath?: string;
  
  // Metrics
  startedAt: Date;
  bandwidth: number;
  bufferHealth: number;
}
```

### Streaming Protocol: HLS

We recommend **HLS (HTTP Live Streaming)** as the primary protocol:

- Universal browser support (including Safari)
- Native iOS/tvOS support
- Simple CDN caching
- Well-understood
- Adaptive bitrate built-in

```
┌─────────────────────────────────────────────────────────────────┐
│                    HLS STREAMING FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Client requests: /play/movie/123/master.m3u8                   │
│                          │                                      │
│                          ▼                                      │
│  Server generates master playlist with quality variants:        │
│  ┌──────────────────────────────────────────┐                   │
│  │ #EXTM3U                                  │                   │
│  │ #EXT-X-STREAM-INF:BANDWIDTH=8000000      │                   │
│  │ quality/high/playlist.m3u8              │                   │
│  │ #EXT-X-STREAM-INF:BANDWIDTH=4000000      │                   │
│  │ quality/medium/playlist.m3u8            │                   │
│  │ #EXT-X-STREAM-INF:BANDWIDTH=1500000      │                   │
│  │ quality/low/playlist.m3u8               │                   │
│  └──────────────────────────────────────────┘                   │
│                          │                                      │
│                          ▼                                      │
│  Client picks quality, requests segment playlist                │
│                          │                                      │
│                          ▼                                      │
│  Server transcodes segments on-demand (or serves direct)        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Playback Decision Logic

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAYBACK DECISION TREE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Can client play video codec natively?                          │
│  ├─ YES: Can client play audio codec natively?                  │
│  │       ├─ YES: Can client handle container?                   │
│  │       │       ├─ YES: Can network handle bitrate?            │
│  │       │       │       ├─ YES: ✅ DIRECT PLAY                 │
│  │       │       │       └─ NO:  ⚡ DIRECT STREAM (lower bitrate)│
│  │       │       └─ NO:  🔄 REMUX (change container only)       │
│  │       └─ NO:  🎵 TRANSCODE AUDIO ONLY                        │
│  └─ NO:  🎬 TRANSCODE VIDEO (+ maybe audio)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Priority Order (Always Try Simpler First)

1. **Direct Play** - No processing, lowest server load
2. **Direct Stream** - Same codecs, lower bitrate
3. **Remux** - Change container only (MKV → MP4)
4. **Audio Transcode** - Video direct, audio converted
5. **Full Transcode** - Everything converted

---

## Transcoding Strategy

### Quality Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSCODING PROFILES                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  QUALITY TIERS:                                                 │
│  ├─ Original    - Direct play when possible                    │
│  ├─ Maximum     - 4K/1080p, high bitrate, preserve HDR         │
│  ├─ High        - 1080p, 10-15 Mbps                            │
│  ├─ Medium      - 720p, 4-8 Mbps                               │
│  ├─ Low         - 480p, 1.5-3 Mbps                             │
│  └─ Mobile      - 360p, 0.5-1.5 Mbps                           │
│                                                                 │
│  HARDWARE ACCELERATION:                                         │
│  ├─ NVIDIA NVENC  - Best quality/speed, requires GPU           │
│  ├─ Intel QSV     - Good, works on most Intel CPUs             │
│  ├─ AMD AMF       - Good, requires AMD GPU                     │
│  ├─ VAAPI         - Linux generic, good                        │
│  ├─ VideoToolbox  - macOS, excellent                           │
│  └─ Software      - Always works, CPU intensive                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Intelligent Bandwidth Management

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  REMOTE PLAYBACK INTELLIGENCE                                   │
│                                                                 │
│  Factors we measure:                                            │
│  ├─ Server upload bandwidth (your internet)                     │
│  ├─ Client download bandwidth (their internet)                  │
│  ├─ Current network conditions (congestion)                     │
│  ├─ Round-trip latency                                          │
│  └─ Server transcoding capacity (can we keep up?)               │
│                                                                 │
│  Example scenario:                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Server upload: 20 Mbps                                  │    │
│  │ Client download: 50 Mbps                                │    │
│  │ Current users: 2 others streaming                       │    │
│  │ Available for this user: ~6 Mbps                        │    │
│  │                                                         │    │
│  │ Decision: 720p @ 4 Mbps with buffer headroom            │    │
│  │ User sees: Smooth playback, good quality                │    │
│  │                                                         │    │
│  │ If bandwidth improves → Auto-upgrade to 1080p           │    │
│  │ If bandwidth drops → Graceful downgrade, no buffering   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Competitive Differentiation

### Feature Comparison

| Feature | Plex Free | Plex Pass | Jellyfin | **Us** |
|---------|-----------|-----------|----------|--------|
| Remote access | Relay (limited) | Relay (full) | DIY only | **Auto + Relay** |
| Quality optimization | Basic | Basic | Manual | **Intelligent** |
| Setup complexity | Medium | Medium | High | **Zero** |
| Sharing invites | Yes | Yes | Manual | **One-click** |
| Per-user quality | No | No | No | **Yes** |
| Pre-transcode for users | No | No | No | **Yes** |
| Bandwidth adaptation | Basic | Basic | None | **Real-time** |
| User bandwidth limits | No | No | No | **Per-user caps** |
| Transparent feedback | Poor | Poor | Poor | **Excellent** |

### Our Unique Advantages

1. **Smart Direct Play Detection** - Transcode only when necessary
2. **User-Friendly Quality Selection** - Clear options with explanations
3. **Transparent Status** - Users understand what's happening
4. **Predictive Pre-transcoding** - Anticipate what users will watch
5. **Effortless Remote Sharing** - No networking knowledge required
6. **Per-User Optimization** - Learn each user's typical needs

---

## Implementation Phases

### Phase 1: Foundation (Direct Play Only)
- Client capability detection
- Direct play for compatible files
- Basic HLS streaming without transcoding
- Simple web player
- **Goal**: Play compatible files end-to-end

### Phase 2: Basic Transcoding
- FFmpeg integration
- Single quality transcoding
- Software encoding
- Subtitle burn-in for incompatible formats
- **Goal**: Play any file on any device

### Phase 3: Production Transcoding
- Hardware acceleration detection and use
- Multiple quality tiers
- Adaptive bitrate streaming
- Segment caching
- **Goal**: Efficient, scalable transcoding

### Phase 4: Remote Access
- Connection strategy implementation
- NAT traversal / hole punching
- Relay service integration
- Bandwidth detection and adaptation
- **Goal**: Seamless remote playback

### Phase 5: Sharing & Optimization
- User invitation system
- Per-user library access
- Pre-transcoding for remote users
- Usage analytics and optimization
- **Goal**: Premium sharing experience

### Phase 6: Polish
- Skip intro detection
- Chapter support
- Watch party sync
- Casting support (Chromecast, AirPlay)
- Offline downloads
- **Goal**: Feature parity with premium services

---

## Error Handling Philosophy

### Bad vs Good Error Messages

```
❌ Bad: "Playback error"
✅ Good: "This 4K file needs to be converted, but your server 
         doesn't have enough power. Try a 1080p version or 
         play on a device that supports 4K HEVC."

❌ Bad: [Spinning forever]
✅ Good: "Preparing your video... 
         Your server is converting this file for your device.
         This usually takes 10-30 seconds."

❌ Bad: "Buffering..."
✅ Good: "Your connection slowed down. 
         Switching to a lower quality to keep playing smoothly."
```

### Graceful Degradation

```
Best case:    Direct play 4K HDR → Beautiful
Good case:    Transcode to 1080p → Still great  
Okay case:    Transcode to 720p → Watchable
Worst case:   "Your server can't play this file right now.
              Here's what you can do: [options]"
```

---

## Summary

The playback system should embody our core product principles:

1. **Reliability over flexibility** - It should always work, even if not perfectly
2. **Opinionated defaults** - Smart choices made for the user
3. **Calm, boring UX** - No stress, no confusion, just plays
4. **Works for non-experts** - Mom can use it
5. **Power available** - Enthusiasts can tweak everything

**The ultimate test**: Can someone share their library with their parents, and have it "just work" for everyone?

