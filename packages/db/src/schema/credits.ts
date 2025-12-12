/**
 * Credits schema - people, cast, and crew.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { movies } from './media.js';
import { tvShows } from './media.js';

/**
 * People table - actors, directors, writers, etc.
 */
export const people = sqliteTable('people', {
  id: text('id').primaryKey(),
  tmdbId: integer('tmdb_id').unique(),
  name: text('name').notNull(),
  profilePath: text('profile_path'),
  profileBlurhash: text('profile_blurhash'),
  knownForDepartment: text('known_for_department'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Movie credits junction table.
 */
export const movieCredits = sqliteTable(
  'movie_credits',
  {
    id: text('id').primaryKey(),
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    roleType: text('role_type', { enum: ['cast', 'crew'] }).notNull(),
    character: text('character'), // For cast
    department: text('department'), // For crew
    job: text('job'), // For crew (Director, Writer, etc.)
    creditOrder: integer('credit_order'),
  }
);

/**
 * Show credits junction table.
 */
export const showCredits = sqliteTable(
  'show_credits',
  {
    id: text('id').primaryKey(),
    showId: text('show_id')
      .notNull()
      .references(() => tvShows.id, { onDelete: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    roleType: text('role_type', { enum: ['cast', 'crew'] }).notNull(),
    character: text('character'), // For cast
    department: text('department'), // For crew
    job: text('job'), // For crew (Creator, etc.)
    creditOrder: integer('credit_order'),
  }
);

