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
	`queue` text DEFAULT 'default' NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`priority` integer DEFAULT 0,
	`target_type` text,
	`target_id` text,
	`target_name` text,
	`progress` real DEFAULT 0,
	`progress_message` text,
	`total_items` integer,
	`processed_items` integer DEFAULT 0,
	`data` text,
	`result` text,
	`error` text,
	`stack_trace` text,
	`attempts_made` integer DEFAULT 0,
	`max_attempts` integer DEFAULT 3,
	`parent_job_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`started_at` text,
	`completed_at` text,
	`duration_ms` integer,
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
CREATE TABLE `content_ratings` (
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`country` text NOT NULL,
	`rating` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`media_type`, `media_id`, `country`)
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
	`intro_start` integer,
	`intro_end` integer,
	`credits_start` integer,
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
CREATE TABLE `genres` (
	`id` text PRIMARY KEY NOT NULL,
	`tmdb_id` integer,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`level` text DEFAULT 'info' NOT NULL,
	`message` text NOT NULL,
	`data` text,
	`timestamp` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `background_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
	`original_language` text,
	`origin_country` text,
	`duration` integer,
	`video_codec` text,
	`audio_codec` text,
	`resolution` text,
	`media_streams` text,
	`direct_playable` integer DEFAULT false,
	`needs_transcode` integer DEFAULT false,
	`subtitle_paths` text,
	`match_status` text DEFAULT 'pending' NOT NULL,
	`credits_start` integer,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` text NOT NULL,
	`scope` text,
	`token_type` text DEFAULT 'Bearer',
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
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
CREATE TABLE `provider_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`provider` text NOT NULL,
	`role_type` text NOT NULL,
	`name` text NOT NULL,
	`external_person_id` text,
	`profile_path` text,
	`character` text,
	`department` text,
	`job` text,
	`credit_order` integer
);
--> statement-breakpoint
CREATE TABLE `provider_episodes` (
	`episode_id` text NOT NULL,
	`provider` text NOT NULL,
	`season_number` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`title` text,
	`overview` text,
	`air_date` text,
	`runtime` integer,
	`still_path` text,
	`vote_average` real,
	`vote_count` integer,
	`guest_stars` text,
	`crew` text,
	`fetched_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`episode_id`, `provider`)
);
--> statement-breakpoint
CREATE TABLE `provider_metadata` (
	`media_type` text NOT NULL,
	`media_id` text NOT NULL,
	`provider` text NOT NULL,
	`title` text NOT NULL,
	`original_title` text,
	`sort_title` text,
	`tagline` text,
	`overview` text,
	`release_date` text,
	`last_air_date` text,
	`runtime` integer,
	`status` text,
	`vote_average` real,
	`vote_count` integer,
	`popularity` real,
	`poster_path` text,
	`backdrop_path` text,
	`logo_path` text,
	`genres` text,
	`content_ratings` text,
	`networks` text,
	`production_companies` text,
	`trailers` text,
	`seasons` text,
	`season_count` integer,
	`episode_count` integer,
	`homepage` text,
	`budget` integer,
	`revenue` integer,
	`production_countries` text,
	`spoken_languages` text,
	`origin_country` text,
	`original_language` text,
	`fetched_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`media_type`, `media_id`, `provider`)
);
--> statement-breakpoint
CREATE TABLE `provider_seasons` (
	`season_id` text NOT NULL,
	`provider` text NOT NULL,
	`season_number` integer NOT NULL,
	`name` text,
	`overview` text,
	`air_date` text,
	`poster_path` text,
	`episode_count` integer,
	`vote_average` real,
	`fetched_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`season_id`, `provider`)
);
--> statement-breakpoint
CREATE TABLE `queue_metrics` (
	`queue` text PRIMARY KEY NOT NULL,
	`completed_count` integer DEFAULT 0,
	`failed_count` integer DEFAULT 0,
	`avg_duration_ms` integer DEFAULT 0,
	`last_job_at` text,
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
CREATE TABLE `system_provider_defaults` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`primary_provider` text DEFAULT 'tmdb',
	`primary_movie_provider` text DEFAULT 'tmdb' NOT NULL,
	`primary_tv_provider` text DEFAULT 'tmdb' NOT NULL,
	`display_movie_provider` text DEFAULT 'tmdb' NOT NULL,
	`display_tv_provider` text DEFAULT 'tmdb' NOT NULL,
	`enabled_rating_sources` text DEFAULT '["imdb", "rt_critics"]' NOT NULL,
	`rating_source_order` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
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
	`network_logo_path` text,
	`content_rating` text,
	`vote_average` real,
	`vote_count` integer,
	`poster_path` text,
	`backdrop_path` text,
	`poster_blurhash` text,
	`backdrop_blurhash` text,
	`genres` text,
	`original_language` text,
	`origin_country` text,
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
	`display_movie_provider` text,
	`display_tv_provider` text,
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
	`preferred_version_id` text,
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
CREATE UNIQUE INDEX `genres_tmdb_id_unique` ON `genres` (`tmdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `genres_name_unique` ON `genres` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `movies_file_path_unique` ON `movies` (`file_path`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_user_provider_idx` ON `oauth_tokens` (`user_id`,`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `people_tmdb_id_unique` ON `people` (`tmdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tv_shows_folder_path_unique` ON `tv_shows` (`folder_path`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_invitations_invite_code_unique` ON `user_invitations` (`invite_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);