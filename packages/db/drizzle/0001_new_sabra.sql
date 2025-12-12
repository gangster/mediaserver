CREATE TABLE `content_ratings` (
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`country` text NOT NULL,
	`rating` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`media_type`, `media_id`, `country`)
);
--> statement-breakpoint
CREATE TABLE `genres` (
	`id` text PRIMARY KEY NOT NULL,
	`tmdb_id` integer,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `movie_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`movie_id` text NOT NULL,
	`person_id` text NOT NULL,
	`role_type` text NOT NULL,
	`character` text,
	`department` text,
	`job` text,
	`credit_order` integer,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `movie_genres` (
	`movie_id` text NOT NULL,
	`genre_id` text NOT NULL,
	PRIMARY KEY(`movie_id`, `genre_id`),
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`tmdb_id` integer,
	`name` text NOT NULL,
	`profile_path` text,
	`profile_blurhash` text,
	`known_for_department` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `show_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`person_id` text NOT NULL,
	`role_type` text NOT NULL,
	`character` text,
	`department` text,
	`job` text,
	`credit_order` integer,
	FOREIGN KEY (`show_id`) REFERENCES `tv_shows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `show_genres` (
	`show_id` text NOT NULL,
	`genre_id` text NOT NULL,
	PRIMARY KEY(`show_id`, `genre_id`),
	FOREIGN KEY (`show_id`) REFERENCES `tv_shows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `trailers` (
	`id` text PRIMARY KEY NOT NULL,
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`name` text,
	`site` text NOT NULL,
	`video_key` text NOT NULL,
	`type` text,
	`official` integer DEFAULT true,
	`published_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_tmdb_id_unique` ON `genres` (`tmdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `genres_name_unique` ON `genres` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `people_tmdb_id_unique` ON `people` (`tmdb_id`);