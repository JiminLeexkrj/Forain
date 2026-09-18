CREATE TABLE `activity_growth_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`diary_id` text NOT NULL,
	`activity_mention_id` text NOT NULL,
	`category` text NOT NULL,
	`raw_growth` real NOT NULL,
	`applied_growth` real DEFAULT 0 NOT NULL,
	`local_date` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`diary_id`) REFERENCES `diaries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_mention_id`) REFERENCES `activity_mentions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_growth_mention` ON `activity_growth_events` (`activity_mention_id`);--> statement-breakpoint
CREATE INDEX `idx_growth_user_date` ON `activity_growth_events` (`user_id`,`local_date`);--> statement-breakpoint
CREATE TABLE `activity_mentions` (
	`id` text PRIMARY KEY NOT NULL,
	`diary_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`confidence` real NOT NULL,
	`evidence` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`raw_growth` real DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`diary_id`) REFERENCES `diaries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_mentions_user_diary` ON `activity_mentions` (`user_id`,`diary_id`);--> statement-breakpoint
CREATE TABLE `daily_growth_ledgers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`local_date` text NOT NULL,
	`category` text NOT NULL,
	`raw_growth` real NOT NULL,
	`applied_growth` real NOT NULL,
	`category_cap` real DEFAULT 3 NOT NULL,
	`total_cap` real DEFAULT 10 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ledger_user_date_category` ON `daily_growth_ledgers` (`user_id`,`local_date`,`category`);--> statement-breakpoint
CREATE TABLE `diaries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'saved' NOT NULL,
	`local_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_diaries_user_created` ON `diaries` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`timezone` text DEFAULT 'Asia/Seoul' NOT NULL,
	`forest_seed` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
