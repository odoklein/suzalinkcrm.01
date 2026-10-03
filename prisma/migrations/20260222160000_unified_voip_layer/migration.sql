-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('IN_PROGRESS', 'PENDING_VALIDATION');

-- AlterTable
ALTER TABLE "Action" ADD COLUMN "actionStatus" "ActionStatus",
ADD COLUMN "voipProvider" TEXT,
ADD COLUMN "voipCallId" TEXT,
ADD COLUMN "voipRecordingUrl" TEXT,
ADD COLUMN "voipSummary" TEXT,
ADD COLUMN "voipTranscript" JSONB,
ADD COLUMN "voipSentiment" TEXT,
ADD COLUMN "voipTopics" JSONB,
ADD COLUMN "voipActionItems" JSONB,
ADD COLUMN "voipEnrichedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserVoipConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "alloNumber" TEXT,
    "aircallUserId" INTEGER,
    "aircallNumberId" INTEGER,
    "ringoverUserId" TEXT,
    "ringoverNumber" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVoipConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoipWorkspaceConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "aircallApiId" TEXT,
    "aircallApiToken" TEXT,
    "aircallWebhookId" INTEGER,
    "aircallWebhookToken" TEXT,
    "ringoverApiKey" TEXT,
    "ringoverWebhookSecret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoipWorkspaceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Action_voipProvider_voipCallId_key" ON "Action"("voipProvider", "voipCallId");

-- CreateIndex
CREATE UNIQUE INDEX "UserVoipConfig_userId_key" ON "UserVoipConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VoipWorkspaceConfig_provider_key" ON "VoipWorkspaceConfig"("provider");

-- AddForeignKey
ALTER TABLE "UserVoipConfig" ADD CONSTRAINT "UserVoipConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
