-- AlterTable
ALTER TABLE `resources` ADD COLUMN `duplicatedFromId` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `photoKey` VARCHAR(100) NULL;

-- AddForeignKey
ALTER TABLE `resources` ADD CONSTRAINT `resources_duplicatedFromId_fkey` FOREIGN KEY (`duplicatedFromId`) REFERENCES `resources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
