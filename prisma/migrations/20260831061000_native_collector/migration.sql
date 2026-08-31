CREATE TABLE `collector_games` (
  `uuid` VARCHAR(191) NOT NULL,
  `filter_id` INTEGER NOT NULL,
  `expected_mode_id` INTEGER NOT NULL,
  `mode_id` INTEGER NULL,
  `start_time` DATETIME(3) NULL,
  `end_time` DATETIME(3) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'DISCOVERED',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME(3) NULL,
  `last_error` TEXT NULL,
  `head` JSON NULL,
  `record_data` LONGBLOB NULL,
  `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`uuid`),
  INDEX `collector_games_status_next_idx` (`status`, `next_attempt_at`),
  INDEX `collector_games_mode_start_idx` (`mode_id`, `start_time`),
  INDEX `collector_games_seen_idx` (`last_seen_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `collector_state` (
  `state_key` VARCHAR(64) NOT NULL,
  `heartbeat_at` DATETIME(3) NULL,
  `last_message` VARCHAR(512) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`state_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
