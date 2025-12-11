# mediaserver

> Your media. Your AI. Your privacy.

A privacy-first, AI-native self-hosted media server built with modern technologies.

## Tech Stack

- **Frontend**: Expo SDK 52+ (iOS, Android, Web, TV)
- **Backend**: Bun + Hono + tRPC
- **Database**: LibSQL + Drizzle ORM
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State**: TanStack Query + Zustand
- **Monorepo**: Nx + Yarn Berry

## Getting Started

### Prerequisites

- Node.js 20+
- Bun 1.1+
- Yarn 3.8+

### Installation

```bash
# Install dependencies
yarn install

# Generate secrets
bunx nanoid --size 64  # For JWT_SECRET
bunx nanoid --size 64  # For JWT_REFRESH_SECRET

# Copy environment file and fill in values
cp .env.example .env

# Run database migrations
yarn db:migrate

# Start development servers
yarn dev
```

### Development Commands

```bash
# Start all development servers
yarn dev

# Start specific apps
yarn nx run @mediaserver/server:dev     # Backend
yarn nx run @mediaserver/mobile:start   # Mobile app

# Build all packages
yarn build

# Run tests
yarn test

# Lint and typecheck
yarn lint
yarn typecheck

# Database commands
yarn db:generate   # Generate migrations
yarn db:migrate    # Run migrations
yarn db:studio     # Open Drizzle Studio
```

## Project Structure

```
mediaserver/
├── apps/
│   ├── mobile/              # iOS + Android (Expo)
│   ├── web/                 # Web app (Expo Web)
│   ├── tv/                  # Android TV + Fire TV + Apple TV
│   └── server/              # Backend (Bun + Hono + tRPC)
├── packages/
│   ├── core/                # Shared types, errors, branding
│   ├── config/              # Configuration schemas (Zod)
│   ├── db/                  # Database schema + migrations
│   ├── privacy/             # Privacy enforcement
│   ├── api-client/          # tRPC client hooks (shared)
│   ├── ui/                  # Shared UI components (NativeWind)
│   ├── player/              # Video player abstraction
│   ├── i18n/                # Internationalization
│   ├── licensing/           # License validation
│   ├── scanner/             # Library scanning
│   ├── transcoder/          # FFmpeg profiles
│   └── images/              # Image proxy
└── ...
```

## Packages Overview

### @mediaserver/core

Core shared utilities:
- `BRANDING` - Centralized branding configuration
- `Result<T, E>` - Result type for error handling
- `AppError` - Structured error classes
- Domain types (User, Movie, TVShow, Episode, etc.)

### @mediaserver/config

Configuration management:
- Environment variable validation with Zod
- Config file loading (YAML/JSON)
- Input validation schemas for API

### @mediaserver/db

Database layer:
- Complete Drizzle ORM schema
- Users, Libraries, Movies, TV Shows, Episodes
- Playback, Collections, Providers, Privacy
- Background jobs and settings

### @mediaserver/privacy

Privacy enforcement:
- `ExternalServiceGuard` - Controls external API calls
- `DataMasker` - Masks sensitive data in logs
- `AuditLogger` - Tracks privacy-sensitive actions

### @mediaserver/ui

Shared UI components:
- Design system (colors, spacing, typography)
- Button, Text, Card components
- Platform utilities (isTV, isMobile, etc.)

### @mediaserver/api-client

API client layer:
- tRPC React Query hooks
- `ApiProvider` component
- Auth, Movies, Shows hooks

## API Routes

### tRPC API (`/api/trpc`)

- `health.*` - Health checks
- `auth.*` - Authentication (login, register, refresh, logout)
- `user.*` - User profile management
- `libraries.*` - Library CRUD and scanning
- `movies.*` - Movie queries
- `shows.*` - TV show queries
- `playback.*` - Watch progress and sessions
- `settings.*` - Admin settings
- `search.*` - Global search

### Streaming API (`/api/stream`)

- `POST /session` - Create playback session
- `GET /:sessionId/master.m3u8` - HLS master playlist
- `GET /:sessionId/:quality/playlist.m3u8` - Quality playlist
- `GET /:sessionId/segment/:index.ts` - Video segments
- `DELETE /session/:sessionId` - End session
- `POST /session/:sessionId/heartbeat` - Progress update

## Security

- Argon2id password hashing
- JWT access tokens (15min) + refresh token rotation
- Role-based access control (owner, admin, member, guest)
- Resource-level permissions (per-library access)
- Rate limiting on auth endpoints
- CORS and security headers
- Privacy-first external service control

## Branding

All branding is centralized in `packages/core/src/branding.ts`. To rename:

1. Update `BRANDING` object
2. Find and replace:
   - `mediaserver` → `{new-name}`
   - `@mediaserver/` → `@{new-name}/`
   - `dev.mediaserver` → `{new-domain}`

## License

AGPL-3.0 (Core) / Proprietary (Premium features)

