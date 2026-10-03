-- CreateEnum
CREATE TYPE "MissionMonthPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('UNCOMMITTED', 'PARTIAL', 'SCHEDULED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('VACATION', 'SICK', 'TRAINING', 'PUBLIC_HOLIDAY', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ConflictSeverity" AS ENUM ('P0', 'P1', 'P2');

-- CreateEnum
CREATE TYPE "ConflictType" AS ENUM ('SDR_OVERLOADED_MONTH', 'SDR_DOUBLE_BOOKED_DAY', 'MISSION_NO_SDR', 'MISSION_UNDERSTAFFED', 'MISSION_OVERSTAFFED', 'SDR_NEAR_CAPACITY', 'ALLOCATION_NOT_SCHEDULED', 'ABSENCE_CONFLICTS_BLOCK', 'CONTRACT_NOT_FULLY_PLANNED', 'MISSION_ENDING_UNPLANNED', 'NO_PLAN_FOR_ACTIVE_MONTH', 'SDR_UNDERUTILIZED');

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN "totalContractDays" INTEGER;

-- AlterTable
ALTER TABLE "ScheduleBlock" ADD COLUMN "allocationId" TEXT;

-- CreateTable
CREATE TABLE "MissionMonthPlan" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "targetDays" INTEGER NOT NULL,
    "status" "MissionMonthPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionMonthPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdrDayAllocation" (
    "id" TEXT NOT NULL,
    "sdrId" TEXT NOT NULL,
    "missionMonthPlanId" TEXT NOT NULL,
    "allocatedDays" INTEGER NOT NULL,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "status" "AllocationStatus" NOT NULL DEFAULT 'UNCOMMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SdrDayAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdrMonthCapacity" (
    "id" TEXT NOT NULL,
    "sdrId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "baseWorkingDays" INTEGER NOT NULL,
    "effectiveAvailableDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SdrMonthCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdrAbsence" (
    "id" TEXT NOT NULL,
    "sdrId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "type" "AbsenceType" NOT NULL,
    "impactsPlanning" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SdrAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningConflict" (
    "id" TEXT NOT NULL,
    "type" "ConflictType" NOT NULL,
    "severity" "ConflictSeverity" NOT NULL,
    "sdrId" TEXT,
    "missionId" TEXT,
    "month" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "suggestedAction" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissionMonthPlan_missionId_idx" ON "MissionMonthPlan"("missionId");
CREATE INDEX "MissionMonthPlan_month_idx" ON "MissionMonthPlan"("month");
CREATE INDEX "MissionMonthPlan_status_idx" ON "MissionMonthPlan"("status");
CREATE UNIQUE INDEX "MissionMonthPlan_missionId_month_key" ON "MissionMonthPlan"("missionId", "month");

-- CreateIndex
CREATE INDEX "SdrDayAllocation_sdrId_idx" ON "SdrDayAllocation"("sdrId");
CREATE INDEX "SdrDayAllocation_missionMonthPlanId_idx" ON "SdrDayAllocation"("missionMonthPlanId");
CREATE UNIQUE INDEX "SdrDayAllocation_sdrId_missionMonthPlanId_key" ON "SdrDayAllocation"("sdrId", "missionMonthPlanId");

-- CreateIndex
CREATE INDEX "SdrMonthCapacity_sdrId_idx" ON "SdrMonthCapacity"("sdrId");
CREATE INDEX "SdrMonthCapacity_month_idx" ON "SdrMonthCapacity"("month");
CREATE UNIQUE INDEX "SdrMonthCapacity_sdrId_month_key" ON "SdrMonthCapacity"("sdrId", "month");

-- CreateIndex
CREATE INDEX "SdrAbsence_sdrId_idx" ON "SdrAbsence"("sdrId");
CREATE INDEX "SdrAbsence_startDate_endDate_idx" ON "SdrAbsence"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "PlanningConflict_severity_idx" ON "PlanningConflict"("severity");
CREATE INDEX "PlanningConflict_month_idx" ON "PlanningConflict"("month");
CREATE INDEX "PlanningConflict_sdrId_idx" ON "PlanningConflict"("sdrId");
CREATE INDEX "PlanningConflict_missionId_idx" ON "PlanningConflict"("missionId");
CREATE INDEX "PlanningConflict_resolvedAt_idx" ON "PlanningConflict"("resolvedAt");

-- CreateIndex
CREATE INDEX "ScheduleBlock_allocationId_idx" ON "ScheduleBlock"("allocationId");

-- AddForeignKey
ALTER TABLE "MissionMonthPlan" ADD CONSTRAINT "MissionMonthPlan_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdrDayAllocation" ADD CONSTRAINT "SdrDayAllocation_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SdrDayAllocation" ADD CONSTRAINT "SdrDayAllocation_missionMonthPlanId_fkey" FOREIGN KEY ("missionMonthPlanId") REFERENCES "MissionMonthPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdrMonthCapacity" ADD CONSTRAINT "SdrMonthCapacity_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdrAbsence" ADD CONSTRAINT "SdrAbsence_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "SdrDayAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
