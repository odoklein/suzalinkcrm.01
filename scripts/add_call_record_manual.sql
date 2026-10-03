-- Run manually: psql $DATABASE_URL -f scripts/add_call_record_manual.sql
-- Or copy-paste into your SQL client.

-- CallRecord table for WithAllo webhook call records
CREATE TABLE IF NOT EXISTS "CallRecord" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "CallRecord_source_externalCallId_key" ON "CallRecord"("source", "externalCallId");
CREATE INDEX IF NOT EXISTS "CallRecord_missionId_idx" ON "CallRecord"("missionId");
CREATE INDEX IF NOT EXISTS "CallRecord_timestamp_idx" ON "CallRecord"("timestamp");

ALTER TABLE "CallRecord" DROP CONSTRAINT IF EXISTS "CallRecord_missionId_fkey";
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallRecord" DROP CONSTRAINT IF EXISTS "CallRecord_contactId_fkey";
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CallRecord" DROP CONSTRAINT IF EXISTS "CallRecord_companyId_fkey";
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
