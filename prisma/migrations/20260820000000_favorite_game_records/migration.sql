CREATE TABLE `favorite_game_records` (
  `favoritePlayerId` VARCHAR(191) NOT NULL,
  `gameRecordId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `favorite_game_records_gameRecordId_idx`(`gameRecordId`),
  PRIMARY KEY (`favoritePlayerId`, `gameRecordId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `favorite_game_records`
  ADD CONSTRAINT `favorite_game_records_favoritePlayerId_fkey`
  FOREIGN KEY (`favoritePlayerId`) REFERENCES `favorite_players`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `favorite_game_records`
  ADD CONSTRAINT `favorite_game_records_gameRecordId_fkey`
  FOREIGN KEY (`gameRecordId`) REFERENCES `game_records`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
