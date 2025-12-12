/**
 * Genres schema - genres and junction tables for movies/shows.
 */

import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { movies } from './media.js';
import { tvShows } from './media.js';

/**
 * Genres lookup table.
 */
export const genres = sqliteTable('genres', {
  id: text('id').primaryKey(),
  tmdbId: integer('tmdb_id').unique(),
  name: text('name').notNull().unique(),
});

/**
 * Movie-genre junction table.
 */
export const movieGenres = sqliteTable(
  'movie_genres',
  {
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    genreId: text('genre_id')
      .notNull()
      .references(() => genres.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.movieId, table.genreId] }),
  })
);

/**
 * Show-genre junction table.
 */
export const showGenres = sqliteTable(
  'show_genres',
  {
    showId: text('show_id')
      .notNull()
      .references(() => tvShows.id, { onDelete: 'cascade' }),
    genreId: text('genre_id')
      .notNull()
      .references(() => genres.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.showId, table.genreId] }),
  })
);

