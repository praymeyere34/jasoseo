CREATE TABLE `phone_verifications` (
	`phone` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer NOT NULL,
	`last_sent_at` integer NOT NULL,
	`send_count` integer NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sms_rate_limits` (
	`scope_key` text PRIMARY KEY NOT NULL,
	`sent_count` integer NOT NULL,
	`window_start` integer NOT NULL
);
