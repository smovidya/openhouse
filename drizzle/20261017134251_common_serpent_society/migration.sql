ALTER TABLE `workshops` ADD `slug` text NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workshops` (
	`id` text PRIMARY KEY,
	`slug` text NOT NULL UNIQUE,
	`title` text NOT NULL,
	`host_department` text NOT NULL,
	`host_department_abbr` text NOT NULL,
	`description` text NOT NULL,
	`capacity` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_workshops`(`id`, `title`, `host_department`, `host_department_abbr`, `description`, `capacity`, `created_at`, `updated_at`, `deleted_at`) SELECT `id`, `title`, `host_department`, `host_department_abbr`, `description`, `capacity`, `created_at`, `updated_at`, `deleted_at` FROM `workshops`;--> statement-breakpoint
DROP TABLE `workshops`;--> statement-breakpoint
ALTER TABLE `__new_workshops` RENAME TO `workshops`;--> statement-breakpoint
PRAGMA foreign_keys=ON;