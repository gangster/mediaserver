CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`user_id` text,
	`session_id` text,
	`data` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`resource` text NOT NULL,
	`details` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `background_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`target_type` text,
	`target_id` text,
	`progress` real DEFAULT 0,
	`progress_message` text,
	`result` text,
	`error` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`started_at` text,
	`completed_at` text,
	`created_by` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`rules` text,
	`sort_order` integer DEFAULT 0,
	`poster_path` text,
	`backdrop_path` text,
	`is_public` integer DEFAULT true,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `data_deletion_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requested_by` text NOT NULL,
	`target_user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`scope` text DEFAULT 'all_user_data' NOT NULL,
	`reason` text,
	`items_deleted` integer,
	`error_message` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `data_export_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requested_by` text NOT NULL,
	`target_user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`format` text DEFAULT 'json' NOT NULL,
	`file_path` text,
	`file_size` integer,
	`error_message` text,
	`expires_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`season_id` text NOT NULL,
	`file_path` text NOT NULL,
	`season_number` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`title` text,
	`tmdb_id` integer,
	`overview` text,
	`air_date` text,
	`runtime` integer,
	`still_path` text,
	`still_blurhash` text,
	`vote_average` real,
	`duration` integer,
	`video_codec` text,
	`audio_codec` text,
	`resolution` text,
	`media_streams` text,
	`direct_playable` integer DEFAULT false,
	`needs_transcode` integer DEFAULT false,
	`subtitle_paths` text,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `tv_shows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `external_ids` (
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`media_type`, `media_id`, `provider`)
);
--> statement-breakpoint
CREATE TABLE `external_request_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`service` text NOT NULL,
	`request_type` text NOT NULL,
	`data_summary` text NOT NULL,
	`status` text NOT NULL,
	`response_time_ms` integer,
	`cached` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`paths` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_scanned_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`library_id` text NOT NULL,
	`can_view` integer DEFAULT true NOT NULL,
	`can_watch` integer DEFAULT true NOT NULL,
	`can_download` integer DEFAULT false NOT NULL,
	`max_content_rating` text,
	`granted_by` text NOT NULL,
	`granted_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `media_ratings` (
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`source` text NOT NULL,
	`score` real NOT NULL,
	`score_normalized` real NOT NULL,
	`score_formatted` text,
	`vote_count` integer,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`media_type`, `media_id`, `source`)
);
--> statement-breakpoint
CREATE TABLE `metadata_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`api_key` text,
	`api_secret` text,
	`enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`settings` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `movies` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`file_path` text NOT NULL,
	`title` text NOT NULL,
	`sort_title` text,
	`year` integer,
	`tmdb_id` integer,
	`imdb_id` text,
	`overview` text,
	`tagline` text,
	`release_date` text,
	`runtime` integer,
	`content_rating` text,
	`vote_average` real,
	`vote_count` integer,
	`poster_path` text,
	`backdrop_path` text,
	`poster_blurhash` text,
	`backdrop_blurhash` text,
	`genres` text,
	`duration` integer,
	`video_codec` text,
	`audio_codec` text,
	`resolution` text,
	`media_streams` text,
	`direct_playable` integer DEFAULT false,
	`needs_transcode` integer DEFAULT false,
	`subtitle_paths` text,
	`match_status` text DEFAULT 'pending' NOT NULL,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playback_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`profile` text NOT NULL,
	`transcode_job_id` text,
	`playlist_path` text,
	`start_position` integer DEFAULT 0,
	`last_heartbeat` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `privacy_settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`level` text DEFAULT 'private' NOT NULL,
	`allow_external_connections` integer DEFAULT false NOT NULL,
	`local_analytics_enabled` integer DEFAULT true NOT NULL,
	`anonymous_sharing_enabled` integer DEFAULT false NOT NULL,
	`tmdb_enabled` integer DEFAULT false NOT NULL,
	`tmdb_proxy_images` integer DEFAULT true NOT NULL,
	`opensubtitles_enabled` integer DEFAULT false NOT NULL,
	`mask_file_paths` integer DEFAULT true NOT NULL,
	`mask_media_titles` integer DEFAULT true NOT NULL,
	`mask_user_info` integer DEFAULT true NOT NULL,
	`mask_ip_addresses` integer DEFAULT true NOT NULL,
	`analytics_retention_days` integer,
	`audit_retention_days` integer,
	`external_log_retention_days` integer DEFAULT 90,
	`anonymous_id` text,
	`anonymous_id_rotated_at` text,
	`last_anonymous_share_at` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `provider_configs` (
	`provider_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`api_key` text,
	`config` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`family_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`rotated_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `remote_access_config` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`tailscale_ip` text,
	`tailscale_hostname` text,
	`last_connected_at` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`season_number` integer NOT NULL,
	`tmdb_id` integer,
	`name` text,
	`overview` text,
	`air_date` text,
	`poster_path` text,
	`poster_blurhash` text,
	`episode_count` integer DEFAULT 0 NOT NULL,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `tv_shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `server_license` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`tier` text DEFAULT 'free' NOT NULL,
	`license_key` text,
	`license_type` text,
	`expires_at` text,
	`features` text,
	`activated_at` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_provider_defaults` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`primary_provider` text DEFAULT 'tmdb' NOT NULL,
	`enabled_rating_sources` text DEFAULT '["imdb", "rt_critics"]' NOT NULL,
	`rating_source_order` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transcode_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`profile` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input_path` text NOT NULL,
	`output_dir` text,
	`playlist_path` text,
	`progress` real DEFAULT 0,
	`current_segment` integer DEFAULT 0,
	`error` text,
	`retry_count` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`started_at` text,
	`completed_at` text,
	`last_accessed_at` text
);
--> statement-breakpoint
CREATE TABLE `tv_shows` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`folder_path` text NOT NULL,
	`title` text NOT NULL,
	`sort_title` text,
	`year` integer,
	`tmdb_id` integer,
	`imdb_id` text,
	`overview` text,
	`first_air_date` text,
	`last_air_date` text,
	`status` text,
	`network` text,
	`content_rating` text,
	`vote_average` real,
	`vote_count` integer,
	`poster_path` text,
	`backdrop_path` text,
	`poster_blurhash` text,
	`backdrop_blurhash` text,
	`genres` text,
	`season_count` integer DEFAULT 0 NOT NULL,
	`episode_count` integer DEFAULT 0 NOT NULL,
	`match_status` text DEFAULT 'pending' NOT NULL,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'guest' NOT NULL,
	`invite_code` text NOT NULL,
	`invited_by` text NOT NULL,
	`library_ids` text,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_provider_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`primary_provider` text,
	`enabled_rating_sources` text,
	`rating_source_order` text,
	`trakt_sync_enabled` integer DEFAULT false,
	`trakt_access_token` text,
	`trakt_refresh_token` text,
	`trakt_token_expiry` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'guest' NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`preferred_audio_lang` text DEFAULT 'en',
	`preferred_subtitle_lang` text,
	`enable_subtitles` integer DEFAULT false,
	`language` text DEFAULT 'en',
	`session_timeout` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE TABLE `watch_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`percentage` real DEFAULT 0 NOT NULL,
	`is_watched` integer DEFAULT false NOT NULL,
	`watched_at` text,
	`play_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_file_path_unique` ON `episodes` (`file_path`);--> statement-breakpoint
CREATE UNIQUE INDEX `movies_file_path_unique` ON `movies` (`file_path`);--> statement-breakpoint
CREATE UNIQUE INDEX `tv_shows_folder_path_unique` ON `tv_shows` (`folder_path`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_invitations_invite_code_unique` ON `user_invitations` (`invite_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);