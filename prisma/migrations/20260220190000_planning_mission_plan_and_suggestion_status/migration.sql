-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

-- CreateEnum
CREATE TYPE "TimePreference" AS ENUM ('MORNING', 'AFTERNOON', 'FULL_DAY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MissionPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "MissionPlan" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "preferredDays" "DayOfWeek"[],
    "timePreference" "TimePreference" NOT NULL,
    "customStartTime" TEXT,
    "customEndTime" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "MissionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionPlanSdr" (
    "id" TEXT NOT NULL,
    "missionPlanId" TEXT NOT NULL,
    "sdrId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionPlanSdr_pkey" PRIMARY KEY ("id")
);

-- AlterTable: ScheduleBlock - add new columns (nullable for backfill)
ALTER TABLE "ScheduleBlock" ADD COLUMN IF NOT EXISTS "suggestionStatus" "SuggestionStatus";
ALTER TABLE "ScheduleBlock" ADD COLUMN IF NOT EXISTS "missionPlanId" TEXT;
ALTER TABLE "ScheduleBlock" ADD COLUMN IF NOT EXISTS "generatedAt" TIMESTAMP(3);

-- Drop unique constraint (allow overlapping SUGGESTED blocks)
ALTER TABLE "ScheduleBlock" DROP CONSTRAINT IF EXISTS "ScheduleBlock_sdrId_date_startTime_key";

-- CreateIndex
CREATE INDEX "MissionPlan_missionId_idx" ON "MissionPlan"("missionId");
CREATE INDEX "MissionPlan_status_idx" ON "MissionPlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MissionPlanSdr_missionPlanId_sdrId_key" ON "MissionPlanSdr"("missionPlanId", "sdrId");
CREATE INDEX "MissionPlanSdr_sdrId_idx" ON "MissionPlanSdr"("sdrId");

-- CreateIndex
CREATE INDEX "ScheduleBlock_missionPlanId_idx" ON "ScheduleBlock"("missionPlanId");
CREATE INDEX "ScheduleBlock_suggestionStatus_idx" ON "ScheduleBlock"("suggestionStatus");

-- AddForeignKey
ALTER TABLE "MissionPlan" ADD CONSTRAINT "MissionPlan_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionPlanSdr" ADD CONSTRAINT "MissionPlanSdr_missionPlanId_fkey" FOREIGN KEY ("missionPlanId") REFERENCES "MissionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionPlanSdr" ADD CONSTRAINT "MissionPlanSdr_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_missionPlanId_fkey" FOREIGN KEY ("missionPlanId") REFERENCES "MissionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
