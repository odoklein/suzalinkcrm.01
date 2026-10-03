-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('CRM_TO_DRIVE', 'DRIVE_TO_CRM', 'BIDIRECTIONAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleDriveConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleDriveEmail" TEXT,
ADD COLUMN     "googleDriveTokens" JSONB;

-- CreateTable
CREATE TABLE "GoogleDriveSync" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "crmFolderId" TEXT,
    "driveFolderId" TEXT NOT NULL,
    "driveFolderName" TEXT NOT NULL,
    "driveFolderPath" TEXT,
    "syncDirection" "SyncDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "autoSync" BOOLEAN NOT NULL DEFAULT false,
    "syncInterval" INTEGER NOT NULL DEFAULT 3600,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "filesSync" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleDriveSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleDriveSync_userId_idx" ON "GoogleDriveSync"("userId");

-- CreateIndex
CREATE INDEX "GoogleDriveSync_crmFolderId_idx" ON "GoogleDriveSync"("crmFolderId");

-- CreateIndex
CREATE INDEX "GoogleDriveSync_isActive_idx" ON "GoogleDriveSync"("isActive");

-- AddForeignKey
ALTER TABLE "GoogleDriveSync" ADD CONSTRAINT "GoogleDriveSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleDriveSync" ADD CONSTRAINT "GoogleDriveSync_crmFolderId_fkey" FOREIGN KEY ("crmFolderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
