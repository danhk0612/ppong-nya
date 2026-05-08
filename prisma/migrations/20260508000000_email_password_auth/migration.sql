ALTER TABLE `users`
  ADD COLUMN `passwordHash` VARCHAR(255) NULL,
  ADD COLUMN `passwordChangeRequired` BOOLEAN NOT NULL DEFAULT false;
