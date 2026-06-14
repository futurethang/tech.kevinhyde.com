CREATE TABLE `feed_item` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`url` text NOT NULL,
	`thumbnail_url` text,
	`author` text,
	`published_at` integer,
	`ingested_at` integer NOT NULL,
	`raw_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_item_source_external_idx` ON `feed_item` (`source_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `item_event` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`event_type` text NOT NULL,
	`at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `feed_item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_event_item_idx` ON `item_event` (`item_id`);--> statement-breakpoint
CREATE TABLE `item_state` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`queued_at` integer,
	`ignored_at` integer,
	`saved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `feed_item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_state_item_id_unique` ON `item_state` (`item_id`);--> statement-breakpoint
CREATE TABLE `item_tag` (
	`item_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`item_id`, `tag_id`),
	FOREIGN KEY (`item_id`) REFERENCES `feed_item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `note` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `feed_item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_item_idx` ON `note` (`item_id`);--> statement-breakpoint
CREATE TABLE `source` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`feed_url` text NOT NULL,
	`exclude_shorts` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`poll_interval_minutes` integer NOT NULL,
	`last_polled_at` integer,
	`last_status` text,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_slug_unique` ON `source` (`slug`);--> statement-breakpoint
CREATE TABLE `source_tag` (
	`source_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`source_id`, `tag_id`),
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `summary` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`input_kind` text NOT NULL,
	`body` text NOT NULL,
	`tokens_in` integer,
	`tokens_out` integer,
	`generated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `feed_item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `summary_item_idx` ON `summary` (`item_id`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_slug_unique` ON `tag` (`slug`);