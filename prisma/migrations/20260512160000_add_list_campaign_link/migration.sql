-- Link List → Campaign so each list owns one strategy/script.
-- 1) Add nullable column
ALTER TABLE "List"
  ADD COLUMN "campaignId" TEXT;

-- 2) Backfill: link each list to its mission's first active Campaign (by createdAt asc).
--    This matches the current SDR-queue "first campaign wins" behavior so day-1 output is identical.
WITH first_camp AS (
    SELECT DISTINCT ON ("missionId")
        "missionId",
        "id" AS "campaignId"
    FROM "Campaign"
    WHERE "isActive" = true
    ORDER BY "missionId", "createdAt" ASC
)
UPDATE "List" l
SET "campaignId" = fc."campaignId"
FROM first_camp fc
WHERE fc."missionId" = l."missionId"
  AND l."campaignId" IS NULL;

-- 3) FK constraint
ALTER TABLE "List"
  ADD CONSTRAINT "List_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Indexes
CREATE INDEX "List_campaignId_idx" ON "List"("campaignId");
CREATE INDEX "Campaign_missionId_isActive_idx" ON "Campaign"("missionId", "isActive");
