-- Stage 6: migrate useful favorite-owned player data into the shared public cache.
-- This migration is intentionally idempotent with INSERT IGNORE / ON DUPLICATE KEY UPDATE
-- semantics so existing public-cache rows remain authoritative.

INSERT INTO `cached_players` (
  `id`,
  `player_id`,
  `nickname`,
  `last_accessed_at`,
  `last_updated_at`,
  `created_at`,
  `updated_at`
)
SELECT
  MIN(`fp`.`id`) AS `id`,
  `fp`.`player_id`,
  SUBSTRING_INDEX(GROUP_CONCAT(`fp`.`nickname` ORDER BY `fp`.`updated_at` DESC SEPARATOR '\n'), '\n', 1) AS `nickname`,
  MAX(`fp`.`updated_at`) AS `last_accessed_at`,
  MAX(`fp`.`updated_at`) AS `last_updated_at`,
  MIN(`fp`.`created_at`) AS `created_at`,
  MAX(`fp`.`updated_at`) AS `updated_at`
FROM `favorite_players` AS `fp`
GROUP BY `fp`.`player_id`
ON DUPLICATE KEY UPDATE
  `nickname` = VALUES(`nickname`),
  `last_accessed_at` = GREATEST(`cached_players`.`last_accessed_at`, VALUES(`last_accessed_at`)),
  `last_updated_at` = CASE
    WHEN `cached_players`.`last_updated_at` IS NULL THEN VALUES(`last_updated_at`)
    ELSE GREATEST(`cached_players`.`last_updated_at`, VALUES(`last_updated_at`))
  END,
  `updated_at` = GREATEST(`cached_players`.`updated_at`, VALUES(`updated_at`));

INSERT IGNORE INTO `cached_player_game_records` (
  `cached_player_id`,
  `game_record_id`,
  `created_at`
)
SELECT
  `cp`.`id`,
  `fgr`.`game_record_id`,
  `fgr`.`created_at`
FROM `favorite_game_records` AS `fgr`
INNER JOIN `favorite_players` AS `fp`
  ON `fp`.`id` = `fgr`.`favorite_player_id`
INNER JOIN `cached_players` AS `cp`
  ON `cp`.`player_id` = `fp`.`player_id`;
