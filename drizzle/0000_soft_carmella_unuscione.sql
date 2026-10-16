CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company` text NOT NULL,
	`position` text NOT NULL,
	`question` text NOT NULL,
	`traits` text NOT NULL,
	`stories` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_drafts_user_updated` ON `drafts` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`phone` text PRIMARY KEY NOT NULL,
	`failed_count` integer NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`user_id` text PRIMARY KEY NOT NULL,
	`answers` text NOT NULL,
	`traits` text NOT NULL,
	`stories` text NOT NULL,
	`company` text NOT NULL,
	`position` text NOT NULL,
	`question` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
