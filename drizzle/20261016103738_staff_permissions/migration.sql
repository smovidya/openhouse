-- Legacy staff permissions were an unused free-text field. Preserve JSON arrays;
-- clear other values instead of inventing access for old development fixtures.
UPDATE `staffs` SET `permission` = CASE
  WHEN json_type(CASE WHEN json_valid(`permission`) THEN `permission` ELSE 'null' END) = 'array'
  THEN `permission` ELSE '[]' END;
--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`id` text PRIMARY KEY,
	`code_hash` text NOT NULL UNIQUE,
	`permission` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
ALTER TABLE `checkpoints` ADD `department` text;--> statement-breakpoint
-- Drizzle Kit RC does not emit index uniqueness changes automatically.
DROP INDEX `idx_attendees_qr_code_id`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_attendees_qr_code_id` ON `attendees` (`qrCodeId`);--> statement-breakpoint
DROP INDEX IF EXISTS `idx_staffs_user_id`;--> statement-breakpoint
CREATE UNIQUE INDEX `checkpoint_logs_active_attendee_checkpoint_unique` ON `checkpoint_logs` (`attendee_id`,`checkpoint_id`) WHERE "checkpoint_logs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `staffs_user_id_unique` ON `staffs` (`user_id`);
