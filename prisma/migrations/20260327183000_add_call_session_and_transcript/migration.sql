-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "sdrId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallTranscript" (
    "id" TEXT NOT NULL,
    "callRecordId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startSeconds" INTEGER,
    "endSeconds" INTEGER,
    "speaker" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallTranscript_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CallRecord"
ADD COLUMN "sessionId" TEXT,
ADD COLUMN "sdrId" TEXT,
ADD COLUMN "durationSeconds" INTEGER,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "endedAt" TIMESTAMP(3),
ADD COLUMN "rawPayload" JSONB;

-- CreateIndex
CREATE INDEX "CallSession_missionId_idx" ON "CallSession"("missionId");

-- CreateIndex
CREATE INDEX "CallSession_sdrId_idx" ON "CallSession"("sdrId");

-- CreateIndex
CREATE INDEX "CallSession_phoneNumber_idx" ON "CallSession"("phoneNumber");

-- CreateIndex
CREATE INDEX "CallSession_status_createdAt_idx" ON "CallSession"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CallTranscript_callRecordId_idx" ON "CallTranscript"("callRecordId");

-- CreateIndex
CREATE INDEX "CallRecord_provider_externalCallId_idx" ON "CallRecord"("provider", "externalCallId");

-- CreateIndex
CREATE INDEX "CallRecord_sessionId_idx" ON "CallRecord"("sessionId");

-- CreateIndex
CREATE INDEX "CallRecord_sdrId_idx" ON "CallRecord"("sdrId");

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CallSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallTranscript" ADD CONSTRAINT "CallTranscript_callRecordId_fkey" FOREIGN KEY ("callRecordId") REFERENCES "CallRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
