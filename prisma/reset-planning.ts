import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Planning Reset Script
 *
 * This script deletes ONLY manager planning data, so you can
 * restart all planning from zero while keeping:
 * - users
 * - clients
 * - missions & SDR assignments
 * - CRM, emails, billing, etc.
 *
 * It clears:
 * - Mission-level plans (MissionPlan, MissionPlanSdr)
 * - Daily schedule blocks (ScheduleBlock)
 * - Monthly mission plans & SDR allocations (MissionMonthPlan, SdrDayAllocation)
 * - SDR monthly capacities (SdrMonthCapacity)
 * - SDR absences (SdrAbsence)
 * - Planning conflicts (PlanningConflict)
 *
 * IMPORTANT: intended for development / controlled environments.
 */

async function resetPlanningOnly() {
  console.log("\n🗓️  Resetting planning data only...\n");

  // Order chosen to avoid any foreign key issues and to be explicit.

  // 1) Conflicts (just derived data)
  await prisma.planningConflict.deleteMany({});
  console.log("✅ Deleted PlanningConflict");

  // 2) Daily schedule blocks (calendar view)
  await prisma.scheduleBlock.deleteMany({});
  console.log("✅ Deleted ScheduleBlock");

  // 3) Day allocations (link between month plans and schedule blocks)
  await prisma.sdrDayAllocation.deleteMany({});
  console.log("✅ Deleted SdrDayAllocation");

  // 4) SDR monthly capacities
  await prisma.sdrMonthCapacity.deleteMany({});
  console.log("✅ Deleted SdrMonthCapacity");

  // 5) SDR absences (vacations, sickness, etc.)
  await prisma.sdrAbsence.deleteMany({});
  console.log("✅ Deleted SdrAbsence");

  // 6) Mission month-level plans
  await prisma.missionMonthPlan.deleteMany({});
  console.log("✅ Deleted MissionMonthPlan");

  // 7) Mission plans and their SDR assignments
  await prisma.missionPlanSdr.deleteMany({});
  console.log("✅ Deleted MissionPlanSdr");

  await prisma.missionPlan.deleteMany({});
  console.log("✅ Deleted MissionPlan");

  console.log("\n✨ Planning data reset complete. All planning is now empty.\n");
}

async function main() {
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║         PLANNING RESET SCRIPT (PLANNING ONLY)     ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log("");
  console.log("This will DELETE all planning-related data (plans,");
  console.log("allocations, capacities, absences, conflicts, etc.)");
  console.log("but will keep missions, clients, SDRs, CRM, emails...");
  console.log("");

  try {
    await resetPlanningOnly();
  } catch (error) {
    console.error("\n❌ Error while resetting planning data:");
    console.error(error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

