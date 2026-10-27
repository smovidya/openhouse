ALTER TABLE `workshop_time_slots` RENAME COLUMN `start_time` TO `starts_at`;--> statement-breakpoint
ALTER TABLE `workshop_time_slots` RENAME COLUMN `end_time` TO `ends_at`;--> statement-breakpoint
CREATE UNIQUE INDEX `workshop_time_slots_workshop_id_round_number_unique` ON `workshop_time_slots` (`workshop_id`,`round_number`);--> statement-breakpoint
ALTER TABLE `workshop_time_slots` DROP COLUMN `date`;