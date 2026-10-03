-- Manual SQL for SDR daily feedback storage (PostgreSQL)
-- Run this once on your DB if you want to create the table manually.

CREATE TABLE IF NOT EXISTS "SdrDailyFeedback" (
    "id" TEXT PRIMARY KEY,
    "sdrId" TEXT NOT NULL,
    "missionId" TEXT NULL,
    "score" INTEGER NOT NULL CHECK ("score" >= 1 AND "score" <= 5),
    "review" TEXT NOT NULL,
    "objections" TEXT NULL,
    "missionComment" TEXT NULL,
    "pagePath" TEXT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SdrDailyFeedback_sdrId_fkey"
        FOREIGN KEY ("sdrId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SdrDailyFeedback_missionId_fkey"
        FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SdrDailyFeedback_sdrId_idx"
    ON "SdrDailyFeedback" ("sdrId");

CREATE INDEX IF NOT EXISTS "SdrDailyFeedback_missionId_idx"
    ON "SdrDailyFeedback" ("missionId");

CREATE INDEX IF NOT EXISTS "SdrDailyFeedback_submittedAt_idx"
    ON "SdrDailyFeedback" ("submittedAt");

CREATE TABLE IF NOT EXISTS "SdrDailyFeedbackMission" (
    "id" TEXT PRIMARY KEY,
    "feedbackId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SdrDailyFeedbackMission_feedbackId_fkey"
        FOREIGN KEY ("feedbackId") REFERENCES "SdrDailyFeedback"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SdrDailyFeedbackMission_missionId_fkey"
        FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SdrDailyFeedbackMission_feedbackId_missionId_key"
        UNIQUE ("feedbackId", "missionId")
);

CREATE INDEX IF NOT EXISTS "SdrDailyFeedbackMission_missionId_idx"
    ON "SdrDailyFeedbackMission" ("missionId");

CREATE INDEX IF NOT EXISTS "SdrDailyFeedbackMission_feedbackId_idx"
    ON "SdrDailyFeedbackMission" ("feedbackId");

-- Backfill join rows from legacy single missionId
INSERT INTO "SdrDailyFeedbackMission" ("id", "feedbackId", "missionId", "createdAt")
SELECT
    md5(random()::text || clock_timestamp()::text),
    f."id",
    f."missionId",
    CURRENT_TIMESTAMP
FROM "SdrDailyFeedback" f
LEFT JOIN "SdrDailyFeedbackMission" j
    ON j."feedbackId" = f."id" AND j."missionId" = f."missionId"
WHERE f."missionId" IS NOT NULL
  AND j."id" IS NULL;
