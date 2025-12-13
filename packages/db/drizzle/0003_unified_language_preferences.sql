-- Drop old subtitle preference tables (replaced by unified playback preferences)
DROP TABLE IF EXISTS `user_subtitle_selections`;
--> statement-breakpoint
DROP TABLE IF EXISTS `user_subtitle_preferences`;
--> statement-breakpoint

-- Add originalLanguage and originCountry to movies
ALTER TABLE `movies` ADD COLUMN `original_language` text;
--> statement-breakpoint
ALTER TABLE `movies` ADD COLUMN `origin_country` text;
--> statement-breakpoint

-- Add originalLanguage and originCountry to tv_shows
ALTER TABLE `tv_shows` ADD COLUMN `original_language` text;
--> statement-breakpoint
ALTER TABLE `tv_shows` ADD COLUMN `origin_country` text;
--> statement-breakpoint

-- Create audio_tracks table
CREATE TABLE `audio_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`stream_index` integer NOT NULL,
	`codec` text NOT NULL,
	`codec_long_name` text,
	`language` text,
	`language_name` text,
	`title` text,
	`channels` integer,
	`channel_layout` text,
	`sample_rate` integer,
	`bit_rate` integer,
	`bits_per_sample` integer,
	`is_default` integer DEFAULT false,
	`is_original` integer DEFAULT false,
	`is_commentary` integer DEFAULT false,
	`is_descriptive` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint

-- Create playback_preferences table (unified audio + subtitle preferences)
CREATE TABLE `playback_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`audio_languages` text DEFAULT '["eng"]' NOT NULL,
	`subtitle_languages` text DEFAULT '["eng"]' NOT NULL,
	`subtitle_mode` text DEFAULT 'auto' NOT NULL,
	`always_show_forced` integer DEFAULT true NOT NULL,
	`prefer_sdh` integer DEFAULT false NOT NULL,
	`prefer_original_audio` integer DEFAULT false NOT NULL,
	`audio_quality` text DEFAULT 'highest' NOT NULL,
	`remember_within_session` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Create language_rules table
CREATE TABLE `language_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`priority` integer DEFAULT 100 NOT NULL,
	`is_built_in` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`conditions` text NOT NULL,
	`audio_languages` text NOT NULL,
	`subtitle_languages` text NOT NULL,
	`subtitle_mode` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Create media_language_overrides table
CREATE TABLE `media_language_overrides` (
	`user_id` text NOT NULL,
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`audio_languages` text,
	`subtitle_languages` text,
	`subtitle_mode` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`user_id`, `media_type`, `media_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Create playback_session_state table
CREATE TABLE `playback_session_state` (
	`user_id` text NOT NULL,
	`show_id` text,
	`last_audio_language` text,
	`last_subtitle_language` text,
	`was_explicit_change` integer DEFAULT false NOT NULL,
	`last_activity_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `show_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`show_id`) REFERENCES `tv_shows`(`id`) ON UPDATE no action ON DELETE cascade
);

