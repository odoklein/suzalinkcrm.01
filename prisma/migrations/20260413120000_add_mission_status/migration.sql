-- Mission lifecycle status migration
-- 1) Add enum
CREATE TYPE "MissionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- 2) Add nullable status temporarily
ALTER TABLE "Mission"
ADD COLUMN "status" "MissionStatus";

-- 3) Backfill from legacy boolean
UPDATE "Mission"
SET "status" = CASE
  WHEN "isActive" = true THEN 'ACTIVE'::"MissionStatus"
  ELSE 'PAUSED'::"MissionStatus"
END
WHERE "status" IS NULL;

-- 4) Enforce NOT NULL + default
ALTER TABLE "Mission"
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- 5) Add indexes
CREATE INDEX "Mission_status_idx" ON "Mission"("status");
CREATE INDEX "Mission_clientId_status_idx" ON "Mission"("clientId", "status");
CREATE INDEX "Mission_status_startDate_endDate_idx" ON "Mission"("status", "startDate", "endDate");
