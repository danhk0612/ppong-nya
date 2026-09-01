CREATE TABLE `game_records` (
    `id` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `source` VARCHAR(80) NULL,
    `sourceRecordId` VARCHAR(191) NULL,
    `uuid` VARCHAR(191) NULL,
    `mode` ENUM('SANMA', 'YONMA') NOT NULL,
    `externalModeId` INTEGER NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,
    `tableName` VARCHAR(120) NULL,
    `rounds` INTEGER NULL,
    `metadata` JSON NULL,
    `rawPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `game_records_mode_startedAt_idx`(`mode`, `startedAt`),
    INDEX `game_records_externalModeId_startedAt_idx`(`externalModeId`, `startedAt`),
    UNIQUE INDEX `game_records_source_sourceRecordId_key`(`source`, `sourceRecordId`),
    UNIQUE INDEX `game_records_source_uuid_key`(`source`, `uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `players` (
    `id` VARCHAR(191) NOT NULL,
    `gameRecordId` VARCHAR(191) NOT NULL,
    `seat` INTEGER NOT NULL,
    `accountId` VARCHAR(191) NULL,
    `nickname` VARCHAR(120) NOT NULL,
    `rankLabel` VARCHAR(64) NULL,
    `score` INTEGER NOT NULL,
    `placement` INTEGER NOT NULL,
    `ratingDelta` DECIMAL(10, 3) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `players_accountId_idx`(`accountId`),
    INDEX `players_placement_idx`(`placement`),
    UNIQUE INDEX `players_gameRecordId_seat_key`(`gameRecordId`, `seat`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cached_players` (
    `id` VARCHAR(191) NOT NULL,
    `player_id` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(120) NOT NULL,
    `level` INTEGER NULL,
    `max_level` INTEGER NULL,
    `latest_timestamp` BIGINT NULL,
    `last_accessed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_updated_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cached_players_player_id_key`(`player_id`),
    INDEX `cached_players_nickname_idx`(`nickname`),
    INDEX `cached_players_last_accessed_at_idx`(`last_accessed_at`),
    INDEX `cached_players_last_updated_at_idx`(`last_updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cached_player_game_records` (
    `cached_player_id` VARCHAR(191) NOT NULL,
    `game_record_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cached_player_games_record_idx`(`game_record_id`),
    PRIMARY KEY (`cached_player_id`, `game_record_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `external_api_caches` (
    `id` VARCHAR(191) NOT NULL,
    `cacheKey` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(512) NOT NULL,
    `method` VARCHAR(12) NOT NULL DEFAULT 'GET',
    `requestBody` LONGTEXT NULL,
    `status` INTEGER NOT NULL,
    `responseHeaders` JSON NULL,
    `payload` JSON NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `external_api_caches_cacheKey_key`(`cacheKey`),
    INDEX `external_api_caches_endpoint_idx`(`endpoint`),
    INDEX `external_api_caches_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

    INDEX `collector_games_status_next_idx` (`status`, `next_attempt_at`),
    INDEX `collector_games_mode_start_idx` (`mode_id`, `start_time`),
    INDEX `collector_games_seen_idx` (`last_seen_at`),
    PRIMARY KEY (`uuid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `collector_state` (
    `state_key` VARCHAR(64) NOT NULL,
    `heartbeat_at` DATETIME(3) NULL,
    `last_message` VARCHAR(512) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`state_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `players`
    ADD CONSTRAINT `players_gameRecordId_fkey`
    FOREIGN KEY (`gameRecordId`) REFERENCES `game_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `cached_player_game_records`
    ADD CONSTRAINT `cached_player_games_player_fkey`
    FOREIGN KEY (`cached_player_id`) REFERENCES `cached_players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `cached_player_games_record_fkey`
    FOREIGN KEY (`game_record_id`) REFERENCES `game_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
