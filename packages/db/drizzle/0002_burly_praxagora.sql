CREATE TABLE `subtitle_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`source` text NOT NULL,
	`stream_index` integer,
	`file_path` text,
	`file_name` text,
	`format` text NOT NULL,
	`language` text,
	`language_name` text,
	`title` text,
	`is_default` integer DEFAULT false,
	`is_forced` integer DEFAULT false,
	`is_sdh` integer DEFAULT false,
	`is_cc` integer DEFAULT false,
	`codec_long_name` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_subtitle_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`preferred_languages` text DEFAULT '["eng"]',
	`show_forced_only` integer DEFAULT false,
	`prefer_sdh` integer DEFAULT false,
	`auto_select` integer DEFAULT true,
	`preferred_format` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_subtitle_selections` (
	`user_id` text NOT NULL,
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`subtitle_track_id` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`user_id`, `media_type`, `media_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
