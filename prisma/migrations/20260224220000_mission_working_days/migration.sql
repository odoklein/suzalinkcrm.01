-- AlterTable
ALTER TABLE "MissionMonthPlan" ADD COLUMN "workingDays" TEXT;
ALTER TABLE "MissionMonthPlan" ADD COLUMN "defaultStartTime" TEXT DEFAULT '09:00';
ALTER TABLE "MissionMonthPlan" ADD COLUMN "defaultEndTime" TEXT DEFAULT '17:00';
