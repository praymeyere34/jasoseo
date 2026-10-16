CREATE TABLE `user_consents` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`version` text NOT NULL,
	`accepted_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `kind`, `version`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
