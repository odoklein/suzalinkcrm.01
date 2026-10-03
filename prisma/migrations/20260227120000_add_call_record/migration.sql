-- CreateTable: CallRecord for WithAllo webhook call records
CREATE TABLE "CallRecord" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "externalCallId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'withallo',
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "duration" INTEGER,
    "direction" TEXT,
    "summary" TEXT,
    "recordingUrl" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CallRecord_source_externalCallId_key" ON "CallRecord"("source", "externalCallId");

-- CreateIndex
CREATE INDEX "CallRecord_missionId_idx" ON "CallRecord"("missionId");

-- CreateIndex
CREATE INDEX "CallRecord_timestamp_idx" ON "CallRecord"("timestamp");

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
