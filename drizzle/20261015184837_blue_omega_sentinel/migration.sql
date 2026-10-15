CREATE TABLE `attendees` (
	`id` text PRIMARY KEY,
	`qrCodeId` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`firstname` text NOT NULL,
	`lastname` text NOT NULL,
	`age` integer NOT NULL,
	`resident_province` text NOT NULL,
	`type` text NOT NULL,
	`school` text,
	`questions` text,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer,
	CONSTRAINT `fk_attendees_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `checkpoint_logs` (
	`id` text PRIMARY KEY,
	`attendee_id` text NOT NULL,
	`checkpoint_id` text NOT NULL,
	`checker_id` text,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer,
	CONSTRAINT `fk_checkpoint_logs_attendee_id_attendees_id_fk` FOREIGN KEY (`attendee_id`) REFERENCES `attendees`(`id`),
	CONSTRAINT `fk_checkpoint_logs_checkpoint_id_checkpoints_id_fk` FOREIGN KEY (`checkpoint_id`) REFERENCES `checkpoints`(`id`),
	CONSTRAINT `fk_checkpoint_logs_checker_id_staffs_id_fk` FOREIGN KEY (`checker_id`) REFERENCES `staffs`(`id`)
);
--> statement-breakpoint
CREATE TABLE `checkpoints` (
	`id` text PRIMARY KEY,
	`name` text,
	`note` text,
	`type` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `reward_redemptions` (
	`id` text PRIMARY KEY,
	`attendee_id` text NOT NULL,
	`checkpoint_id` text NOT NULL,
	`checker_id` text,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer,
	CONSTRAINT `fk_reward_redemptions_attendee_id_attendees_id_fk` FOREIGN KEY (`attendee_id`) REFERENCES `attendees`(`id`),
	CONSTRAINT `fk_reward_redemptions_checkpoint_id_checkpoints_id_fk` FOREIGN KEY (`checkpoint_id`) REFERENCES `checkpoints`(`id`),
	CONSTRAINT `fk_reward_redemptions_checker_id_staffs_id_fk` FOREIGN KEY (`checker_id`) REFERENCES `staffs`(`id`)
);
--> statement-breakpoint
CREATE TABLE `staffs` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`department` text,
	`phone` text NOT NULL,
	`permission` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer,
	CONSTRAINT `fk_staffs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `survey_responses` (
	`id` text PRIMARY KEY,
	`attendee_id` text NOT NULL,
	`answer` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer,
	CONSTRAINT `fk_survey_responses_attendee_id_attendees_id_fk` FOREIGN KEY (`attendee_id`) REFERENCES `attendees`(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`google_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`role` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `workshop_registrations` (
	`id` text PRIMARY KEY,
	`workshop_time_slot_id` text NOT NULL,
	`attendee_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer,
	CONSTRAINT `fk_workshop_registrations_workshop_time_slot_id_workshop_time_slots_id_fk` FOREIGN KEY (`workshop_time_slot_id`) REFERENCES `workshop_time_slots`(`id`),
	CONSTRAINT `fk_workshop_registrations_attendee_id_attendees_id_fk` FOREIGN KEY (`attendee_id`) REFERENCES `attendees`(`id`)
);
--> statement-breakpoint
CREATE TABLE `workshop_time_slots` (
	`id` text PRIMARY KEY,
	`workshop_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`date` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer,
	CONSTRAINT `fk_workshop_time_slots_workshop_id_workshops_id_fk` FOREIGN KEY (`workshop_id`) REFERENCES `workshops`(`id`)
);
--> statement-breakpoint
CREATE TABLE `workshops` (
	`id` text PRIMARY KEY,
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
CREATE INDEX `idx_attendees_qr_code_id` ON `attendees` (`qrCodeId`);--> statement-breakpoint
CREATE INDEX `idx_staffs_user_id` ON `staffs` (`user_id`);