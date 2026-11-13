CREATE TABLE IF NOT EXISTS `User` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL DEFAULT '',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `User_email_key` (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `HealthProfile` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `displayName` VARCHAR(191) NOT NULL DEFAULT '林同学',
  `goal` VARCHAR(191) NOT NULL DEFAULT '温和减脂',
  `dietaryNotes` VARCHAR(1000) NOT NULL DEFAULT '',
  `data` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `HealthProfile_userId_key` (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MealRecord` (
  `id` VARCHAR(191) NOT NULL,
  `profileId` VARCHAR(191) NOT NULL,
  `eatenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `title` VARCHAR(191) NOT NULL,
  `mealType` ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER') NOT NULL DEFAULT 'OTHER',
  `items` JSON NOT NULL,
  `estimatedKcal` INTEGER NULL,
  `lowerKcal` INTEGER NULL,
  `upperKcal` INTEGER NULL,
  `proteinG` DOUBLE NULL,
  `carbsG` DOUBLE NULL,
  `fatG` DOUBLE NULL,
  `notes` VARCHAR(1000) NOT NULL DEFAULT '',
  `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `MealRecord_profileId_eatenAt_idx` (`profileId`, `eatenAt`),
  INDEX `MealRecord_status_createdAt_idx` (`status`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PlanVersion` (
  `id` VARCHAR(191) NOT NULL,
  `profileId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `plan` JSON NOT NULL,
  `activeAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PlanVersion_profileId_version_key` (`profileId`, `version`),
  INDEX `PlanVersion_profileId_activeAt_idx` (`profileId`, `activeAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PlanAdjustment` (
  `id` VARCHAR(191) NOT NULL,
  `profileId` VARCHAR(191) NOT NULL,
  `dayKey` VARCHAR(10) NOT NULL,
  `nextDayKey` VARCHAR(10) NOT NULL,
  `baseVersion` INTEGER NOT NULL,
  `adjustment` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PlanAdjustment_profileId_dayKey_key` (`profileId`, `dayKey`),
  INDEX `PlanAdjustment_profileId_updatedAt_idx` (`profileId`, `updatedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Feedback` (
  `id` VARCHAR(191) NOT NULL,
  `profileId` VARCHAR(191) NOT NULL,
  `topic` VARCHAR(191) NOT NULL,
  `rating` INTEGER NULL,
  `note` VARCHAR(1000) NOT NULL DEFAULT '',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Feedback_profileId_createdAt_idx` (`profileId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WeightRecord` (
  `id` VARCHAR(191) NOT NULL,
  `profileId` VARCHAR(191) NOT NULL,
  `dateKey` VARCHAR(10) NOT NULL,
  `kg` DOUBLE NOT NULL,
  `note` VARCHAR(100) NOT NULL DEFAULT '',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `WeightRecord_profileId_dateKey_key` (`profileId`, `dateKey`),
  INDEX `WeightRecord_profileId_dateKey_idx` (`profileId`, `dateKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `KnowledgeChunk` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `source` VARCHAR(512) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `embedding` JSON NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `KnowledgeChunk_source_idx` (`source`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `HealthProfile`
  ADD CONSTRAINT `HealthProfile_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `MealRecord`
  ADD CONSTRAINT `MealRecord_profileId_fkey`
  FOREIGN KEY (`profileId`) REFERENCES `HealthProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PlanVersion`
  ADD CONSTRAINT `PlanVersion_profileId_fkey`
  FOREIGN KEY (`profileId`) REFERENCES `HealthProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PlanAdjustment`
  ADD CONSTRAINT `PlanAdjustment_profileId_fkey`
  FOREIGN KEY (`profileId`) REFERENCES `HealthProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Feedback`
  ADD CONSTRAINT `Feedback_profileId_fkey`
  FOREIGN KEY (`profileId`) REFERENCES `HealthProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WeightRecord`
  ADD CONSTRAINT `WeightRecord_profileId_fkey`
  FOREIGN KEY (`profileId`) REFERENCES `HealthProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
