-- Stage 1: shared player cache schema. Existing user/favorite tables are intentionally preserved
-- until their data has been migrated and the public data path is verified.

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

CREATE TABLE `player_query_coverages` (
    `id` VARCHAR(191) NOT NULL,
    `cached_player_id` VARCHAR(191) NOT NULL,
    `mode_key` VARCHAR(191) NOT NULL,
    `period_start` DATETIME(3) NOT NULL,
    `period_end` DATETIME(3) NOT NULL,
    `fetched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `player_coverage_range_idx`(`cached_player_id`, `period_start`, `period_end`),
    INDEX `player_coverage_fetched_idx`(`fetched_at`),
    UNIQUE INDEX `player_coverage_unique_range`(`cached_player_id`, `mode_key`, `period_start`, `period_end`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `player_statistics_caches` (
    `id` VARCHAR(191) NOT NULL,
    `cached_player_id` VARCHAR(191) NOT NULL,
    `cache_key` VARCHAR(191) NOT NULL,
    `mode_key` VARCHAR(191) NOT NULL,
    `period_start` DATETIME(3) NOT NULL,
    `period_end` DATETIME(3) NOT NULL,
    `payload` JSON NOT NULL,
    `computed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `player_stats_cache_key`(`cache_key`),
    INDEX `player_stats_range_idx`(`cached_player_id`, `period_start`, `period_end`),
    INDEX `player_stats_expires_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `cached_player_game_records`
    ADD CONSTRAINT `cached_player_games_player_fkey`
    FOREIGN KEY (`cached_player_id`) REFERENCES `cached_players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `cached_player_games_record_fkey`
    FOREIGN KEY (`game_record_id`) REFERENCES `game_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `player_query_coverages`
    ADD CONSTRAINT `player_coverage_player_fkey`
    FOREIGN KEY (`cached_player_id`) REFERENCES `cached_players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `player_statistics_caches`
    ADD CONSTRAINT `player_stats_player_fkey`
    FOREIGN KEY (`cached_player_id`) REFERENCES `cached_players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
