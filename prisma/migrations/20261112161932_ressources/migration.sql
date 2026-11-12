-- CreateTable
CREATE TABLE `resources` (
    `id` CHAR(36) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `type` ENUM('COURSE', 'TUTORIAL', 'LAB', 'EXAM', 'SOLUTION', 'VIDEO', 'LINK', 'OTHER') NOT NULL,
    `keywords` VARCHAR(500) NOT NULL DEFAULT '',
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `visibility` ENUM('PRIVATE', 'TEACHERS', 'EC_STUDENTS') NOT NULL DEFAULT 'PRIVATE',
    `publishAt` DATETIME(3) NULL,
    `approvalStatus` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'NOT_REQUIRED',
    `approvedById` CHAR(36) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `everPublished` BOOLEAN NOT NULL DEFAULT false,
    `authorId` CHAR(36) NOT NULL,
    `academicYearId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `resources_status_visibility_academicYearId_idx`(`status`, `visibility`, `academicYearId`),
    INDEX `resources_authorId_idx`(`authorId`),
    FULLTEXT INDEX `resources_title_keywords_description_idx`(`title`, `keywords`, `description`),
    FULLTEXT INDEX `resources_title_idx`(`title`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resource_course_elements` (
    `resourceId` CHAR(36) NOT NULL,
    `courseElementId` CHAR(36) NOT NULL,

    INDEX `resource_course_elements_courseElementId_idx`(`courseElementId`),
    PRIMARY KEY (`resourceId`, `courseElementId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resource_versions` (
    `id` CHAR(36) NOT NULL,
    `resourceId` CHAR(36) NOT NULL,
    `number` INTEGER NOT NULL,
    `storageKey` VARCHAR(100) NULL,
    `externalUrl` VARCHAR(1000) NULL,
    `originalName` VARCHAR(255) NULL,
    `mimeType` VARCHAR(100) NULL,
    `format` VARCHAR(20) NOT NULL,
    `sizeBytes` INTEGER NULL,
    `comment` VARCHAR(500) NOT NULL DEFAULT '',
    `authorId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `resource_versions_format_idx`(`format`),
    UNIQUE INDEX `resource_versions_resourceId_number_key`(`resourceId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `access_logs` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `resourceId` CHAR(36) NULL,
    `versionId` CHAR(36) NULL,
    `kind` ENUM('VIEW', 'DOWNLOAD') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `access_logs_resourceId_kind_createdAt_idx`(`resourceId`, `kind`, `createdAt`),
    INDEX `access_logs_userId_resourceId_kind_createdAt_idx`(`userId`, `resourceId`, `kind`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `resources` ADD CONSTRAINT `resources_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resources` ADD CONSTRAINT `resources_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resources` ADD CONSTRAINT `resources_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resource_course_elements` ADD CONSTRAINT `resource_course_elements_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `resources`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resource_course_elements` ADD CONSTRAINT `resource_course_elements_courseElementId_fkey` FOREIGN KEY (`courseElementId`) REFERENCES `course_elements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resource_versions` ADD CONSTRAINT `resource_versions_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `resources`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resource_versions` ADD CONSTRAINT `resource_versions_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `access_logs` ADD CONSTRAINT `access_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `access_logs` ADD CONSTRAINT `access_logs_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `resources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `access_logs` ADD CONSTRAINT `access_logs_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `resource_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Une version porte soit un fichier, soit un lien externe, jamais les deux (RG6, A8).
ALTER TABLE `resource_versions` ADD CONSTRAINT `resource_versions_content_check`
  CHECK ((`storageKey` IS NULL) <> (`externalUrl` IS NULL));

-- Taille maximale d'un fichier : 100 Mo (RG8).
ALTER TABLE `resource_versions` ADD CONSTRAINT `resource_versions_size_check`
  CHECK (`sizeBytes` IS NULL OR `sizeBytes` <= 104857600);
