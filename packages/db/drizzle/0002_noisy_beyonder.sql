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
CREATE TABLE `queue_metrics` (
	`queue` text PRIMARY KEY NOT NULL,
	`completed_count` integer DEFAULT 0,
	`failed_count` integer DEFAULT 0,
	`avg_duration_ms` integer DEFAULT 0,
	`last_job_at` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
/*
 SQLite does not support "Set default to column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html
                  https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3

 Due to that we don't generate migration automatically and it has to be done manually
*/--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `queue` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `priority` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `target_name` text;--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `total_items` integer;--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `processed_items` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `data` text;--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `stack_trace` text;--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `attempts_made` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `max_attempts` integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `parent_job_id` text;--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `duration_ms` integer;