# CLAUDE.md - AI Assistant Guide for Mediaserver

This document provides context and guidance for AI assistants working on the mediaserver project.

## Project Overview

Mediaserver is a self-hosted media server application (similar to Plex/Jellyfin) built as an Nx monorepo with:
- **Web app** (`apps/web`): Expo/React Native Web frontend
- **Mobile app** (`apps/mobile`): Expo React Native mobile app  
- **TV app** (`apps/tv`): Expo React Native TV app
- **Server** (`apps/server`): Bun/Hono/tRPC backend
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
- **Runtime**: Bun
- **Framework**: Hono
- **API**: tRPC
- **Database**: SQLite with Drizzle ORM
- **Auth**: Custom JWT implementation

### Package Manager
- **Yarn 3.8.0** with PnP disabled (uses `node_modules`)
- Always use `yarn` not `npm`

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

## Development Workflow

### Running the Dev Server
```bash
# Start web app
cd apps/web && npx expo start --web --port 8081

# Or use nx
yarn nx run web:start

# Clear cache if styles aren't updating
npx expo start --web --port 8081 --clear
```

### Running Tasks
Always use Nx for running tasks:
```bash
yarn nx run web:typecheck
yarn nx run web:lint
yarn nx run-many -t typecheck
yarn nx run-many -t lint
```

### Database
```bash
yarn db:migrate    # Run migrations
yarn db:generate   # Generate types from schema
yarn db:studio     # Open Drizzle Studio
```

### Killing Stuck Processes
```bash
pkill -f "expo start"
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

## Reference Project

When implementing features, reference the forreel project at `/Users/josh/play/forreel`. Key differences:
- forreel uses React Router DOM → mediaserver uses Expo Router
- forreel uses standard HTML/CSS → mediaserver uses React Native primitives/NativeWind
- forreel uses standard Tailwind → mediaserver uses NativeWind (with limitations noted above)

## Troubleshooting

### Styles Not Updating
1. Kill expo: `pkill -f "expo start"`
2. Clear cache: `npx expo start --web --port 8081 --clear`

### Module Resolution Errors
If packages from workspace aren't resolving, add them as direct dependencies in `apps/web/package.json`.

### TypeScript Errors with Web-Only Styles
Use `as const` assertion or wrap in object:
```tsx
style={{ backdropFilter: 'blur(8px)' } as const}
```

### useLayoutEffect Warning
The `useLayoutEffect does nothing on the server` warning is from react-navigation and can be ignored - it doesn't affect client-side functionality.
