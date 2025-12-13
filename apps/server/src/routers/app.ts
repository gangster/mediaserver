/**
 * Main application router.
 *
 * Combines all sub-routers into the main app router.
 */

import { router } from './trpc.js';
import { authRouter } from './auth.js';
import { userRouter } from './user.js';
import { healthRouter } from './health.js';
import { librariesRouter } from './libraries.js';
import { moviesRouter } from './movies.js';
import { showsRouter } from './shows.js';
import { playbackRouter } from './playback.js';
import { searchRouter } from './search.js';
import { settingsRouter } from './settings.js';
import { setupRouter } from './setup.js';
import { metadataRouter } from './metadata.js';
import { integrationsRouter } from './integrations.js';
import { jobsRouter } from './jobs.js';
import { subtitlesRouter } from './subtitles.js';
import { audioRouter } from './audio.js';
import { playbackPreferencesRouter } from './playback-preferences.js';

/**
 * Main application router.
 *
 * This router is exported for use in the client.
 */
export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  user: userRouter,
  libraries: librariesRouter,
  movies: moviesRouter,
  shows: showsRouter,
  playback: playbackRouter,
  search: searchRouter,
  settings: settingsRouter,
  setup: setupRouter,
  metadata: metadataRouter,
  integrations: integrationsRouter,
  jobs: jobsRouter,
  subtitles: subtitlesRouter,
  audio: audioRouter,
  playbackPreferences: playbackPreferencesRouter,
});

/** Type of the app router - used for client type inference */
export type AppRouter = typeof appRouter;

