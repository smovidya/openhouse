CREATE TABLE `reward_gifts` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`tier` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer,
	CONSTRAINT "reward_gifts_tier_check" CHECK("tier" IN (1, 2, 3))
);
--> statement-breakpoint
ALTER TABLE `checkpoint_logs` ADD `workshop_id` text REFERENCES workshops(id);--> statement-breakpoint
ALTER TABLE `checkpoint_logs` ADD `attendance_type` text;--> statement-breakpoint
ALTER TABLE `checkpoint_logs` ADD `removed_by_id` text REFERENCES staffs(id);--> statement-breakpoint
ALTER TABLE `checkpoint_logs` ADD `removal_reason` text;--> statement-breakpoint
ALTER TABLE `checkpoints` ADD `workshop_time_slot_id` text REFERENCES workshop_time_slots(id);--> statement-breakpoint
CREATE UNIQUE INDEX `checkpoint_logs_active_attendee_workshop_unique` ON `checkpoint_logs` (`attendee_id`,`workshop_id`) WHERE "checkpoint_logs"."deleted_at" IS NULL AND "checkpoint_logs"."workshop_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `checkpoints_active_workshop_time_slot_unique` ON `checkpoints` (`workshop_time_slot_id`) WHERE "checkpoints"."deleted_at" IS NULL AND "checkpoints"."workshop_time_slot_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `reward_redemptions` ADD `gift_id` text REFERENCES reward_gifts(id);--> statement-breakpoint
ALTER TABLE `reward_redemptions` ADD `tier` integer CONSTRAINT "reward_redemptions_tier_check" CHECK("tier" IS NULL OR "tier" IN (1, 2, 3));--> statement-breakpoint
ALTER TABLE `reward_redemptions` ADD `gift_name` text;--> statement-breakpoint
ALTER TABLE `reward_redemptions` ADD `progress_snapshot` text;--> statement-breakpoint
CREATE UNIQUE INDEX `reward_redemptions_active_attendee_unique` ON `reward_redemptions` (`attendee_id`) WHERE "reward_redemptions"."deleted_at" IS NULL;
