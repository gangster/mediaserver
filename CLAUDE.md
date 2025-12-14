# CLAUDE.md - AI Assistant Guide for Mediaserver

This document provides context and guidance for AI assistants working on the mediaserver project.

---

## 🚨 CRITICAL: Always Use Nix Dev Shell 🚨

**EVERY shell command MUST be run inside the Nix dev shell.** This is non-negotiable.

```bash
# ✅ CORRECT - Always prefix with nix develop -c
nix develop -c yarn dev
nix develop -c yarn nx run web:typecheck
nix develop -c yarn install

# ❌ WRONG - Never run commands directly
yarn dev                    # Will fail - missing dependencies
yarn nx run web:typecheck   # Will fail - missing environment
```

The Nix flake provides Node.js, Valkey, SQLite, ffmpeg, and all environment variables. Commands run outside the shell WILL fail.

---

## Project Overview

Mediaserver is a self-hosted media server application (similar to Plex/Jellyfin) built as an Nx monorepo with:
- **Web app** (`apps/web`): Expo/React Native Web frontend
- **Mobile app** (`apps/mobile`): Expo React Native mobile app  
- **TV app** (`apps/tv`): Expo React Native TV app
- **Server** (`apps/server`): Node.js/Hono/tRPC backend
- **Shared packages** (`packages/*`): Reusable code across apps

The project replicates features from the `forreel` project at `/Users/josh/play/forreel`. When implementing features, reference forreel's implementation but adapt for React Native Web/NativeWind.

## Tech Stack

### Frontend (apps/web)
- **Framework**: Expo with React Native Web
- **Routing**: Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind for React Native)
- **State**: Zustand for client state, TanStack Query for server state
- **API**: tRPC with `@mediaserver/api-client` hooks

### Backend (apps/server)
- **Runtime**: Node.js 20 (with tsx for development)
- **Framework**: Hono
- **API**: tRPC
- **Database**: SQLite with Drizzle ORM
- **Job Queue**: BullMQ with Valkey (Redis-compatible)
- **Auth**: Custom JWT implementation

**⚠️ IMPORTANT: The server uses Node.js, NOT Bun.** While Bun is available in the Nix flake for other tooling, the server runs with:
- Development: `node --import tsx src/main.ts`
- Production: `node dist/main.js`

### Package Manager
- **Yarn 3.8.0** with PnP disabled (uses `node_modules`)
- Always use `yarn` not `npm`

### Transcoding & Playback Pipeline

> **Full spec:** [`docs/TRANSCODING_PIPELINE.md`](docs/TRANSCODING_PIPELINE.md) (v5.0)

The transcoding pipeline enables playback on any device from any server hardware.

#### 7-Tier Playback Hierarchy

The system attempts playback in strict fallback order:

| Priority | Mode | Video | Audio | When |
|----------|------|-------|-------|------|
| 1 | Direct Play | Source | Source | Client supports everything |
| 2 | Direct + Audio Transcode | Source | Encode | Video OK, audio unsupported |
| 3 | Remux | Copy | Copy | Container incompatible |
| 4 | Remux + Audio Transcode | Copy | Encode | Container fix + audio |
| 5 | Remux-to-HLS | Copy | Copy | Range unreliable, keyframes OK |
| 6 | Remux-to-HLS + Audio Transcode | Copy | Encode | HLS + audio transcode |
| 7 | Transcode-to-HLS | Encode | Encode | Full transcode needed |

**Rule: Never show "format not supported" error.** Always fall back gracefully.

#### Key Concepts

- **PlaybackPlan**: Single source of truth for all playback decisions. Computed once, drives FFmpeg commands, cache keys, and logging.
- **FFmpegCapabilityManifest**: Runtime-tested manifest of encoders, decoders, filters, and hwaccel support. Gates all decision branches.
- **Epochs**: HLS discontinuities triggered by seeks, track switches, quality changes. Each epoch resets `MEDIA-SEQUENCE` to 0.

#### FFmpeg Patterns

```bash
# Probe media
ffprobe -v quiet -print_format json -show_format -show_streams input.mkv

# Audio-only transcode (video copy) - fast startup, low CPU
ffmpeg -i input.mkv -c:v copy -c:a aac -b:a 256k -f hls -hls_time 4 out.m3u8

# HLS with required flags
ffmpeg -i input.mkv \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k \
  -f hls -hls_time 4 -hls_list_size 0 \
  -muxdelay 0 -muxpreload 0 \
  -avoid_negative_ts make_zero -start_at_zero \
  playlist.m3u8
```

#### Content Quirks

| Quirk | Detection | Handling |
|-------|-----------|----------|
| Interlaced | `field_order` in probe | `yadif` or `bwdif` filter |
| Variable Frame Rate | Multiple `avg_frame_rate` | `-vsync cfr -r {target}` |
| Sparse Keyframes | Keyframe analysis >8s | Force transcode (no remux-to-HLS) |
| Legacy Container (AVI) | Format name | Remux to MP4 |

#### Resume Position Contract

Resume time is **always stored in source-file time**, regardless of playback speed or transcoding.

#### Seeking Past Transcoded Content

When seeking to a position that hasn't been transcoded yet:

1. **Client detects seek beyond transcoded range** (position > transcodedTime + 30s)
2. **Client calls server `playback.seek` endpoint** with target position
3. **Server restarts FFmpeg** at the new position, creating a new epoch
4. **Server waits for first segment** before returning (ensures immediate playback)
5. **Client reloads HLS source** via `playerRef.current.reloadSource()`
6. **Client updates `epochOffset`** to the new start position

```typescript
// In VideoPlayer, handleSeek:
if (targetTime > transcodedTime + safeBuffer) {
  // Server-side seek needed
  const result = await serverSeek(targetTime);
  epochOffsetRef.current = result.startPosition;  // Update epoch offset
  playerRef.current.reloadSource(0); // Start at epoch beginning (video time 0)
}
```

**transcodedTime tracking**:
- Initialized to `startPosition` when session is created
- Updated on each heartbeat response from server
- Used to decide local seek (within transcoded) vs server-side seek (beyond transcoded)

#### Cache Key Components

Cache keys derived from PlaybackPlan include:
- Media ID + pipeline version
- Mode + container
- Video action/codec + audio action/codec/channels
- Subtitle mode + HDR mode
- Quirk flags (deinterlace, CFR conversion)
- Speed + audio normalization

#### Related Files

- Types: `packages/core/src/types/playback.ts`, `packages/core/src/types/transcoding.ts`
- Router: `apps/server/src/routers/playback.ts`
- Schema: `packages/db/src/schema/playback.ts`
- Transcode Session: `apps/server/src/services/transcode-session.ts` (FFmpeg lifecycle, seek mutex)
- Streaming Service: `apps/server/src/services/streaming-service.ts` (session management)

### HLS Streaming & Video Player

The web player uses **hls.js** for HLS streaming. Understanding this system is critical for debugging playback issues.

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Client (WebVideoPlayer.tsx)                                         │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│ │ VideoPlayer │───▶│ hls.js      │───▶│ <video>     │              │
│ │ (container) │    │ (HLS lib)   │    │ element     │              │
│ └─────────────┘    └──────┬──────┘    └─────────────┘              │
└────────────────────────────┼────────────────────────────────────────┘
                             │ HTTP + Auth Header
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Server (stream.ts routes)                                           │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│ │ /session    │    │ /master.m3u8│    │ /playlist   │              │
│ │ (create)    │    │ (variants)  │    │ .m3u8       │              │
│ └─────────────┘    └─────────────┘    └──────┬──────┘              │
│                                              │                      │
│ ┌─────────────────────────────────────────────┴─────────────────┐  │
│ │ /tmp/mediaserver/transcode/{sessionId}/                       │  │
│ │   ├── master.m3u8      (written at session creation)          │  │
│ │   ├── playlist.m3u8    (written by FFmpeg, served directly)   │  │
│ │   └── segment_*.ts     (written by FFmpeg, served directly)   │  │
│ └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FFmpeg Process                                                       │
│ - Reads source file                                                  │
│ - Writes segments + playlist.m3u8 to disk                           │
│ - Uses EVENT playlist type for live transcoding                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/components/player/WebVideoPlayer.tsx` | hls.js integration, video element |
| `apps/web/src/components/player/VideoPlayer.tsx` | Player container, session management, epoch offset |
| `apps/web/src/lib/hls-config.ts` | hls.js configuration |
| `apps/server/src/routes/stream.ts` | HLS routes (playlists, segments) |
| `apps/server/src/services/streaming-service.ts` | Session management, FFmpeg orchestration |
| `apps/server/src/services/transcode-session.ts` | FFmpeg process lifecycle, seek mutex, epoch management |
| `apps/server/src/services/ffmpeg-builder.ts` | FFmpeg command generation |
| `packages/api-client/src/hooks/usePlaybackSession.ts` | Client-side session hook, transcodedTime tracking |

#### HLS.js Configuration Gotchas

**⚠️ CRITICAL: Config Validation Rules**

hls.js throws errors for invalid configs. Key constraints:

```typescript
// ❌ WRONG - Will throw "liveMaxLatencyDuration must be greater than liveSyncDuration"
{
  liveSyncDuration: 9999,
  liveMaxLatencyDuration: 9999,  // Must be GREATER than liveSyncDuration
}

// ✅ CORRECT
{
  liveSyncDuration: 9999,
  liveMaxLatencyDuration: 99999,  // > liveSyncDuration
}
```

**Why we use these settings:** We use FFmpeg's `EVENT` playlist type for "watch while transcoding" - this looks like a live stream to hls.js. Setting high `liveSyncDuration` prevents hls.js from jumping to the "live edge" (end of available content).

#### Session Flow

1. **Client creates session** via `playback.createSession` tRPC mutation
2. **Server probes media**, creates PlaybackPlan, starts FFmpeg
3. **Server writes `master.m3u8`** to disk immediately
4. **FFmpeg writes segments** (`segment_00000.ts`, etc.) and `playlist.m3u8` 
5. **Client loads `master.m3u8`** → points to `playlist.m3u8`
6. **hls.js fetches segments** as needed for playback

#### Auth Token Injection

HLS requests need auth tokens. We inject them via `xhrSetup`:

```typescript
// apps/web/src/lib/hls-config.ts
export async function createHlsConfig(dataSaver = false) {
  const token = await getAccessToken();  // Wait for Zustand hydration!
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

**⚠️ The config creation is async** because `getAccessToken()` must wait for Zustand store hydration.

#### Debugging Playback Issues

**Console Filtering:** Browser DevTools may filter out `console.warn` messages by default. Enable "All levels" in the console filter dropdown when debugging.

**Metro Bundler Caching:** If code changes aren't taking effect:
```bash
# Full cache clear
pkill -f "expo start"
rm -rf apps/web/.expo apps/web/node_modules/.cache
nix develop -c bash -c "cd apps/web && npx expo start --web --port 8081 --clear"
```

**Check HLS Init Flow:** Look for these logs in order:
1. `[HLS Init] Using hls.js for HLS stream`
2. `[HLS Config] Creating config`
3. `[HLS Init] Config created, mounted: true`
4. `[HLS Init] Creating HLS instance...`
5. `[HLS Init] HLS created:`
6. `[HLS Init] Attaching to video element...`
7. `[HLS Init] Loading source:`

If flow stops after "Config created", check for config validation errors.

**Common HLS Errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `liveMaxLatencyDuration must be greater than liveSyncDuration` | Config validation | Make `liveMaxLatencyDuration > liveSyncDuration` |
| `404 on master.m3u8` | Session not created or expired | Check server logs, refresh page |
| `401 on segment requests` | Auth token not attached | Check `xhrSetup` in hls-config.ts |
| No network requests from hls.js | HLS instance creation failed | Check for sync errors in console |

#### FFmpeg HLS Settings

Key FFmpeg flags for HLS generation:

```bash
ffmpeg -i input.mkv \
  -f hls \                           # HLS output format
  -hls_time 4 \                      # 4-second segments
  -hls_list_size 0 \                 # Keep all segments in playlist
  -hls_playlist_type event \         # EVENT for live transcoding
  -hls_segment_filename segment_%05d.ts \
  -start_number 0 \
  -hls_flags independent_segments \  # Each segment self-contained
  playlist.m3u8
```

**Why EVENT not VOD?** 
- `VOD` waits for all segments before writing playlist (no live viewing)
- `EVENT` writes playlist progressively (watch while transcoding works)
- We append `#EXT-X-ENDLIST` when transcoding completes

#### Duration Handling

For EVENT playlists, hls.js may report `Infinity` as duration. We handle this by:
1. Server returns actual duration in session creation response
2. Client stores duration from session
3. `handleDurationChange` ignores `Infinity` values from hls.js

```typescript
// WebVideoPlayer.tsx
const handleDurationChange = () => {
  if (Number.isFinite(video.duration) && video.duration > 0) {
    emitStateChange({ duration: video.duration });
  }
  // Ignore Infinity - use duration from session instead
};
```

### UI Components (Gluestack-UI v3)

**Always use gluestack-ui components when building UIs.** Components are located in `apps/web/src/components/ui/`.

```tsx
// ✅ CORRECT - Use gluestack components
import { Button, ButtonText, Input, InputField, Spinner, Card } from '../src/components/ui';

<Button action="primary" size="md">
  <ButtonText>Save Changes</ButtonText>
</Button>

<Input>
  <InputField placeholder="Enter text..." value={value} onChangeText={setValue} />
</Input>

<Spinner size="large" className="text-indigo-500" />

// ❌ WRONG - Don't create custom buttons/inputs
<Pressable className="px-4 py-2 bg-emerald-600 rounded-lg">
  <Text>Save Changes</Text>
</Pressable>
```

**Available components:**
- **Buttons**: `Button`, `ButtonText`, `ButtonIcon`, `ButtonSpinner`, `ButtonGroup`
- **Forms**: `Input`, `InputField`, `InputSlot`, `InputIcon`, `Select`, `Switch`, `Checkbox`
- **Feedback**: `Spinner`, `Badge`, `Toast`
- **Layout**: `Card`, `Modal`, `ModalBackdrop`, `ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter`

**If a component you need isn't installed, add it:**
```bash
nix develop -c bash -c "cd apps/web && npx gluestack-ui add <component-name>"
```

Common components to add as needed:
- `npx gluestack-ui add accordion`
- `npx gluestack-ui add alert`
- `npx gluestack-ui add avatar`
- `npx gluestack-ui add menu`
- `npx gluestack-ui add popover`
- `npx gluestack-ui add progress`
- `npx gluestack-ui add slider`
- `npx gluestack-ui add tabs`
- `npx gluestack-ui add textarea`
- `npx gluestack-ui add tooltip`

**⚠️ IMPORTANT:** Never build custom UI components (buttons, inputs, modals, etc.) from scratch. Always check if gluestack has the component first and install it if needed. This ensures consistent styling and accessibility across the app.

### Nix Development Environment

**🚨 CRITICAL: ALL commands must run inside the Nix dev shell.**

The flake provides essential dependencies and environment variables. Running commands outside the shell will fail.

```bash
# Recommended: Use the dev script (handles Valkey, server, and web)
nix develop -c yarn dev      # Start all services
nix develop -c yarn stop     # Stop all services
nix develop -c yarn status   # Check service status
nix develop -c yarn logs     # Tail all logs

# For individual commands:
nix develop -c yarn install
nix develop -c yarn nx run web:typecheck
nix develop -c yarn nx run-many -t lint

# Or enter the shell for interactive work:
nix develop
yarn dev
```

The flake provides:
- Node.js 20 and Yarn (via corepack)
- Valkey (Redis-compatible for job queues)
- SQLite and ffmpeg
- Required environment variables (`DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, etc.)

**⚠️ Common Mistake:** Do NOT use `bun run` for the server. Always use `yarn dev` or `node`/`tsx` commands.

## Critical NativeWind/React Native Web Gotchas

### 1. Responsive Classes Don't Work
NativeWind responsive breakpoint classes like `hidden lg:flex`, `lg:ml-64` do NOT work reliably.

**❌ Don't do this:**
```tsx
<View className="hidden lg:flex" />
<View className="lg:ml-64" />
```

**✅ Do this instead:**
```tsx
import { useWindowDimensions } from 'react-native';

const { width } = useWindowDimensions();
const isDesktop = width >= 1024;

{isDesktop && <Sidebar />}
<View style={{ marginLeft: isDesktop ? 256 : 0 }} />
```

### 2. CSS Grid Doesn't Work
CSS Grid classes (`grid`, `grid-cols-*`) don't work in NativeWind.

**❌ Don't do this:**
```tsx
<View className="grid grid-cols-4 gap-4" />
```

**✅ Do this instead:**
```tsx
<View className="flex flex-row flex-wrap" style={{ gap: 16 }}>
  <View style={{ flex: 1, minWidth: 150 }}>{/* item */}</View>
</View>
```

### 3. Fixed Positioning Requires Inline Styles
`position: fixed` works on web but must use inline styles.

**✅ Correct approach:**
```tsx
<View
  style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  }}
/>
```

### 4. vh/vw Units Don't Work
React Native doesn't support viewport units.

**❌ Don't do this:**
```tsx
style={{ height: '100vh', paddingTop: '15vh' }}
```

**✅ Do this instead:**
```tsx
const { height } = useWindowDimensions();
style={{ height: height, paddingTop: height * 0.15 }}
```

### 5. group-hover Doesn't Work
NativeWind's `group-hover:*` classes don't work. Use state-based hover handling.

**✅ Use Pressable with state:**
```tsx
<Pressable onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}>
  <View style={{ opacity: hovered ? 1 : 0 }} />
</Pressable>
```

### 6. Web-Only CSS Properties
Properties like `backdropFilter`, `boxShadow`, `outlineStyle` work on web but need type handling:

```tsx
<View
  style={{
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  } as const}
/>
```

### 7. Use React Native Primitives
Always use React Native components, not HTML elements.

**❌ Don't do this:**
```tsx
<div className="...">
<span>text</span>
<button onClick={}>
<input type="text" />
```

**✅ Do this instead:**
```tsx
<View className="...">
<Text>text</Text>
<Pressable onPress={}>
<TextInput value={} onChangeText={} />
```

### 8. Don't Use Custom Setter Wrappers for Side Effects
React Native Web's TextInput doesn't reliably call custom setter functions. Closures may capture stale state.

**❌ Don't do this:**
```tsx
const [apiKey, setApiKeyInternal] = useState('');
const [enabled, setEnabled] = useState(false);
const [testResult, setTestResult] = useState(null);

// Custom wrapper - unreliable with TextInput!
const setApiKey = (value: string) => {
  setApiKeyInternal(value);
  setTestResult(null);  // May not execute
  if (!value) setEnabled(false);  // May not execute
};

<TextInput value={apiKey} onChangeText={setApiKey} />
```

**✅ Do this instead - use `useEffect` for derived state changes:**
```tsx
const [apiKey, setApiKey] = useState('');
const [enabled, setEnabled] = useState(false);
const [testResult, setTestResult] = useState(null);
const [initialized, setInitialized] = useState(false);

// React to state changes with useEffect
useEffect(() => {
  if (!initialized) return;
  setTestResult(null);  // Clear when key changes
  if (!apiKey) setEnabled(false);  // Auto-disable if cleared
}, [apiKey, initialized]);

<TextInput value={apiKey} onChangeText={setApiKey} />
```

This pattern ensures side effects run reliably because React guarantees `useEffect` fires after state updates.

## Development Workflow

### Starting Development (Recommended)
```bash
# Start everything: Valkey + Server + Web UI
nix develop -c yarn dev

# This starts:
#   - Valkey on port 6379 (job queue)
#   - Server on http://localhost:3000
#   - Web UI on http://localhost:8081

# Stop all services
nix develop -c yarn stop

# Check status
nix develop -c yarn status

# View logs
nix develop -c yarn logs           # All logs
nix develop -c yarn logs:server    # Server only
nix develop -c yarn logs:web       # Web only
```

### Running Individual Apps (Manual)
```bash
# Start web app only
nix develop -c yarn nx run web:start

# Clear cache if styles aren't updating
nix develop -c bash -c "cd apps/web && npx expo start --web --port 8081 --clear"
```

### Running Tasks
Always use Nx for running tasks (within Nix shell):
```bash
nix develop -c yarn nx run web:typecheck
nix develop -c yarn nx run web:lint
nix develop -c yarn nx run-many -t typecheck
nix develop -c yarn nx run-many -t lint
```

### Database
```bash
nix develop -c yarn db:migrate    # Run migrations
nix develop -c yarn db:generate   # Generate types from schema
nix develop -c yarn db:studio     # Open Drizzle Studio
```

### Killing Stuck Processes
```bash
pkill -f "expo start"
pkill -f "node --import tsx"
nix develop -c yarn stop          # Graceful shutdown of all services
```

## API Client Usage

Use hooks from `@mediaserver/api-client`:

```tsx
import { useMovies, useShows, useSearch, useLibraries } from '@mediaserver/api-client';

// Fetching data
const { data, isLoading } = useMovies({ page: 1, limit: 20 });

// Search with enabled flag
const { data } = useSearch({ query, limit: 8 }, query.length > 0);
```

## Image URLs

Images are served from the server's image proxy:
```
http://localhost:3000/api/images/movies/{id}/poster?size=small
http://localhost:3000/api/images/shows/{id}/backdrop?size=large
```

## File Organization

```
apps/web/
├── app/                    # Expo Router pages
│   ├── _layout.tsx        # Root layout with providers
│   ├── index.tsx          # Home page
│   ├── movies/
│   │   ├── index.tsx      # Movies list
│   │   └── [id].tsx       # Movie detail
│   └── tv/
│       ├── index.tsx      # TV shows list
│       └── [id].tsx       # Show detail
├── src/
│   ├── components/
│   │   ├── home/          # Home page components
│   │   ├── layout/        # Layout components
│   │   ├── media/         # Media display components
│   │   ├── navigation/    # Nav components
│   │   └── search/        # Search components
│   ├── hooks/             # Custom hooks
│   └── stores/            # Zustand stores
```

## Routing with Expo Router

Use `expo-router` for navigation:

```tsx
import { Link, useRouter, usePathname } from 'expo-router';

// Declarative navigation
<Link href="/movies/123" asChild>
  <Pressable>{/* content */}</Pressable>
</Link>

// Programmatic navigation
const router = useRouter();
router.push('/movies/123');

// Get current path
const pathname = usePathname();
```

**Type-safe routes**: Cast href when TypeScript complains:
```tsx
router.push(path as '/movies/[id]');
<Link href={path as '/movies'} />
```

## Keyboard Event Handling

For keyboard shortcuts in modals/inputs, use `onKeyPress` on the element itself rather than document event listeners (avoids stale closure issues):

```tsx
const handleKeyPress = useCallback((e: { nativeEvent: { key: string } }) => {
  if (e.nativeEvent.key === 'Escape') {
    onClose();
  }
}, [onClose]);

<TextInput onKeyPress={handleKeyPress} />
```

For global shortcuts (like Cmd+K), use document listeners in a hook with proper cleanup:
```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => !prev);
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []);
```

## Common Patterns

### Conditional Desktop/Mobile Rendering
```tsx
const { width } = useWindowDimensions();
const isDesktop = width >= 1024;

return (
  <View>
    {isDesktop ? <Sidebar /> : <MobileTopBar />}
    <View style={{ marginLeft: isDesktop ? 256 : 0 }}>
      {children}
    </View>
    {!isDesktop && <BottomNav />}
  </View>
);
```

### Auth Check
```tsx
import { useAuth } from '../hooks/useAuth';

const { user, isAdmin, isInitialized, logout } = useAuth();

if (!isInitialized) return <LoadingScreen />;
if (!user) return <Redirect href="/login" />;
```

### Zustand Store with Persistence
```tsx
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'preferences',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

### Cache Updates Before Navigation (tRPC/TanStack Query)
When navigating after a mutation that changes data used by route guards (like `AuthGuard`), **don't rely on `invalidate()` alone** - it's async and won't complete before navigation.

**❌ Don't do this:**
```tsx
return trpc.setup.complete.useMutation({
  onSuccess: () => {
    utils.setup.status.invalidate(); // Async! Won't complete in time
  },
});
// Then immediately: router.replace('/libraries')
// AuthGuard still sees stale data → redirects back!
```

**✅ Do this instead:**
```tsx
return trpc.setup.complete.useMutation({
  onSuccess: () => {
    // Optimistically update cache synchronously
    const currentData = utils.setup.status.getData();
    if (currentData) {
      utils.setup.status.setData(undefined, {
        ...currentData,
        isComplete: true,
      });
    }
    // Also invalidate for fresh data on next fetch
    utils.setup.status.invalidate();
  },
});
```

This ensures route guards see the updated state immediately before navigation occurs.

## Reference Project

When implementing features, reference the forreel project at `/Users/josh/play/forreel`. Key differences:
- forreel uses React Router DOM → mediaserver uses Expo Router
- forreel uses standard HTML/CSS → mediaserver uses React Native primitives/NativeWind
- forreel uses standard Tailwind → mediaserver uses NativeWind (with limitations noted above)

### Adapting Forreel Components

When porting components from forreel:

1. **Replace HTML elements with React Native primitives:**
   - `div` → `View`
   - `span`, `p`, `h1-h6` → `Text`
   - `button` → `Pressable`
   - `input` → `TextInput`
   - `img` → `Image`
   - `select` → Custom dropdown with `Pressable` + modal/overlay

2. **Replace React Router with Expo Router:**
   - `Link` from `react-router-dom` → `Link` from `expo-router`
   - `useNavigate()` → `useRouter()` with `router.push()`
   - Route params: `useParams()` → `useLocalSearchParams()`

3. **Replace SVG icons with @expo/vector-icons:**
   - Import from `@expo/vector-icons` (e.g., `Ionicons`, `Feather`, `MaterialCommunityIcons`)
   - Use `<Feather name="search" size={20} color="#a1a1aa" />` instead of inline SVGs

4. **Handle CSS Grid → Flexbox:**
   - Replace `grid grid-cols-*` with `flexDirection: 'row', flexWrap: 'wrap'`
   - Calculate item widths manually based on `useWindowDimensions()`

5. **Preserve inline styles for web-specific features:**
   - Use `style={{ ... } as const}` for `backdropFilter`, `boxShadow`, `position: 'fixed'`

## ID Validation

Library IDs and other generated IDs use `nanoid` format (21-character strings), not UUIDs. Use `idSchema` from `@mediaserver/config` for validation instead of `uuidSchema`:

```typescript
import { idSchema } from '@mediaserver/config';

// In tRPC router
scan: protectedProcedure
  .input(z.object({ id: idSchema }))  // ✅ Accepts nanoid
  .mutation(...)
```

## Troubleshooting

### Commands Failing with Missing Dependencies or Env Vars
You're likely running outside the Nix dev shell. Always use:
```bash
nix develop -c <command>
# or
nix develop   # then run commands inside the shell
```

### Server Not Starting / API Calls Failing
1. Check if services are running: `nix develop -c yarn status`
2. Check logs: `nix develop -c yarn logs:server`
3. Restart services: `nix develop -c yarn restart`

### Styles Not Updating
1. Kill expo: `pkill -f "expo start"`
2. Clear cache: `nix develop -c bash -c "cd apps/web && npx expo start --web --port 8081 --clear"`

### Module Resolution Errors
If packages from workspace aren't resolving, add them as direct dependencies in `apps/web/package.json`.

### TypeScript Errors with Web-Only Styles
Use `as const` assertion or wrap in object:
```tsx
style={{ backdropFilter: 'blur(8px)' } as const}
```

### useLayoutEffect Warning
The `useLayoutEffect does nothing on the server` warning is from react-navigation and can be ignored - it doesn't affect client-side functionality.

### Zustand Store Hydration Race Conditions
When using Zustand's `persist` middleware, the store isn't immediately hydrated from localStorage. API calls that need auth tokens may fire before hydration completes.

**Solution**: Make `getAccessToken()` async and wait for hydration:
```typescript
export async function getAccessToken(): Promise<string | null> {
  // Wait for store hydration
  if (!useAuthStore.persist.hasHydrated()) {
    await new Promise<void>((resolve) => {
      const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
        unsubscribe();
        resolve();
      });
    });
  }
  return useAuthStore.getState().accessToken;
}
```

### Browser Cache After Database Reset
After resetting the database (deleting `mediaserver.db`), the browser may still have stale auth tokens and setup state in localStorage. Clear it:
```javascript
localStorage.clear(); location.reload();
```

### Port Already In Use
If the server fails with `EADDRINUSE`:
```bash
lsof -ti:3000 | xargs kill -9
```

### Video Player Stuck on Spinner
1. **Check browser console for HLS errors** - Look for config validation errors or 401/404 on requests
2. **Verify session was created** - Should see `playback.createSession` succeed in Network tab
3. **Check FFmpeg is running** - Server logs should show "Starting FFmpeg" and segment generation
4. **Clear Metro cache** - Code changes may not be taking effect (see above)
5. **Check transcode directory** - Files should appear in `/tmp/mediaserver/transcode/{sessionId}/`

### Resume Stuck on Spinner (Specific Case)
If resuming playback shows correct time but video doesn't start:
- **Root cause**: `startTime` prop was passing resume position to video element
- **Fix**: For transcoded content, `startTime` must be `0` (FFmpeg already seeks via `-ss`)
- The `epochOffset` handles translating video element time to display time
- Check VideoPlayer passes: `startTime={session?.directPlay ? startPosition : 0}`

### HLS.js `bufferSeekOverHole` Warning
```json
{ "type": "mediaError", "details": "bufferSeekOverHole", "fatal": false }
```
**This is normal and non-fatal.** HLS.js detected a small gap (0-0.1s) at stream start and automatically seeked over it. Caused by FFmpeg seeking to nearest keyframe.

### HLS Playback Erratic/Jumping
This usually means hls.js is treating EVENT playlist as live stream:
- Verify `liveSyncDuration` and `liveMaxLatencyDuration` are set high in hls-config.ts
- Ensure `liveMaxLatencyDuration > liveSyncDuration` (validation will fail otherwise)
- Check `backBufferLength: Infinity` is set to prevent buffer pruning

### playback.heartbeat Returns 400
The heartbeat validation expects:
- `sessionId`: nanoid format (use `idSchema` not `uuidSchema`)
- `position`: number (floats allowed)
- `isPlaying`: boolean
- `buffering`: boolean (optional, defaults false)

Check that the session actually exists in the database - it's inserted during `createSession`.

### Multiple FFmpeg Processes Running (FFmpeg Leak)
**Symptom**: `ps aux | grep ffmpeg` shows many processes for same session.

**Causes**:
1. Rapid seeks spawning FFmpeg before previous killed
2. FFmpeg exit handler triggering unwanted restart during seek

**Diagnosis**:
```bash
ps aux | grep ffmpeg | grep -v grep | wc -l  # Should be 1-2
```

**Cleanup**:
```bash
pkill -9 -f "ffmpeg.*transcode"
rm -rf /tmp/mediaserver/transcode/*
nix develop -c yarn restart
```

**Prevention** (implemented in transcode-session.ts):
- Seek mutex (`seekInProgress` promise) serializes seek operations
- `handleFFmpegExit` checks `ffmpegState.status === 'stopping'` before restart
- Session sets `status = 'ending'` BEFORE stopping FFmpeg

### Seek Works Sometimes, Fails Sometimes
**Cause**: Client wasn't tracking `transcodedTime` properly.

**Fix**: 
- Heartbeat returns `transcodedTime` from server
- Client initializes `transcodedTime` to `startPosition` on session creation
- Seek logic checks `targetTime > transcodedTime + 30s` to decide local vs server seek

### No Audio/Video Codec Support Errors
The PlaybackPlan should fall back through the 7-tier hierarchy. If you see codec errors:
1. Check `FFmpegCapabilityManifest` was generated at server start
2. Verify client capabilities are being sent in session creation
3. Check server logs for the playback plan decision

### Session Cleanup and Idle Timeouts
Sessions are automatically cleaned up after 60 seconds of inactivity (no heartbeat). The cleanup timer runs every 15 seconds. If sessions are not being cleaned up:
1. Check server logs for "Cleaning up idle session" messages
2. Verify heartbeat endpoint is being called by client
3. Check `lastAccessAt` timestamp in session info

### Video Duration Shows as Infinity
This is expected for EVENT playlists during live transcoding. The player should:
1. Use the `duration` value from the session creation response (from ffprobe)
2. Store this in `knownDurationRef` and use it as the authoritative duration
3. Ignore hls.js duration updates that report `Infinity`

### Premature "Ended" Event
If the video shows "Finished" prematurely during transcoding:
1. Check `handleEnded` in WebVideoPlayer.tsx - it should verify `currentTime >= knownDuration - 10`
2. If not near the end, it should set status to `buffering`, not `ended`
3. This prevents false endings when hls.js runs out of buffered segments

### Quality Selector Shows Wrong Resolution
The quality selector uses tier-based height thresholds:
- `>= 1800` → 4K (includes widescreen 4K like 3840x1600)
- `>= 800` → 1080p (includes widescreen like 1920x800)
- `>= 600` → 720p
- etc.

If labels are wrong, check `getQualityLabel()` in `hls-config.ts`.

### Volume Slider Error: Cannot read 'getBoundingClientRect'
This happens when the slider element becomes null during drag. The fix is to capture `e.currentTarget` into a local variable at the start of `handleDragStart`, before any async operations or event listener callbacks.

### First Segment Timeout
If transcoding is slow (especially 4K on modest hardware), increase timeouts:
- `firstSegmentTimeoutMs`: 45000 (45 seconds)
- `noProgressTimeoutMs`: 60000 (60 seconds)

These are configured in `streaming-service.ts`.
