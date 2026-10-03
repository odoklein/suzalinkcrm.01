-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('queued', 'ringing', 'in_progress', 'completed', 'failed');

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "outboundPhoneNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_outboundPhoneNumber_key" ON "User"("outboundPhoneNumber");

-- CreateTable
CREATE TABLE IF NOT EXISTS "Call" (
    "id" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "campaignId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "status" "CallStatus" NOT NULL DEFAULT 'queued',
    "durationSeconds" INTEGER,
    "recordingUrl" TEXT,
    "externalCallId" TEXT,
    "actionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Call_actionId_key" ON "Call"("actionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Call_userId_idx" ON "Call"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Call_startTime_idx" ON "Call"("startTime");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Call_status_idx" ON "Call"("status");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;
