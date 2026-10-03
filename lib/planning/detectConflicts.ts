import type { PrismaClient } from "@prisma/client";
import { ConflictType, ConflictSeverity } from "@prisma/client";
import type { CapacityMatrix } from "./capacityMatrix";

function dateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function upsertConflict(
  prisma: PrismaClient,
  params: {
    type: ConflictType;
    severity: ConflictSeverity;
    sdrId?: string | null;
    missionId?: string | null;
    month: string;
    message: string;
    suggestedAction?: string | null;
  }
) {
  const existing = await prisma.planningConflict.findFirst({
    where: {
      type: params.type,
      sdrId: params.sdrId ?? null,
      missionId: params.missionId ?? null,
      month: params.month,
      resolvedAt: null,
    },
  });

  if (existing) {
    await prisma.planningConflict.update({
      where: { id: existing.id },
      data: {
        message: params.message,
        suggestedAction: params.suggestedAction ?? null,
        severity: params.severity,
      },
    });
  } else {
    await prisma.planningConflict.create({
      data: {
        type: params.type,
        severity: params.severity,
        sdrId: params.sdrId ?? null,
        missionId: params.missionId ?? null,
        month: params.month,
        message: params.message,
        suggestedAction: params.suggestedAction ?? null,
      },
    });
  }
}

async function clearConflict(
  prisma: PrismaClient,
  params: {
    type: ConflictType;
    sdrId?: string | null;
    missionId?: string | null;
    month: string;
  }
) {
  await prisma.planningConflict.updateMany({
    where: {
      type: params.type,
      sdrId: params.sdrId ?? null,
      missionId: params.missionId ?? null,
      month: params.month,
      resolvedAt: null,
    },
    data: { resolvedAt: new Date() },
  });
}

/**
 * Detect conflicts from capacity matrix and write to PlanningConflict.
 * Call after building the matrix to persist date-aware conflicts.
 */
export async function detectConflictsFromMatrix(
  matrix: CapacityMatrix,
  prisma: PrismaClient
): Promise<void> {
  const { month, cells, missionCoverage, sdrIds, missionIds, sdrNames, missionNames } = matrix;

  // 1. MISSION_NOT_COVERED: coverage cell sdrCount=0 and not isPreStart
  for (let mi = 0; mi < missionIds.length; mi++) {
    const missionId = missionIds[mi];
    const missionName = missionNames[missionId] ?? missionId;
    const row = missionCoverage[mi];
    const uncoveredDates: string[] = [];
    for (let di = 0; di < row.length; di++) {
      const cell = row[di];
      if (!cell.isPreStart && !cell.isPostEnd && cell.sdrCount === 0) {
        uncoveredDates.push(dateToKey(cell.date));
      }
    }
    if (uncoveredDates.length > 0) {
      await upsertConflict(prisma, {
        type: "MISSION_NOT_COVERED",
        severity: "P0",
        missionId,
        month,
        message: `${missionName} — aucun SDR assigné le(s) ${uncoveredDates.slice(0, 3).join(", ")}${uncoveredDates.length > 3 ? "…" : ""}`,
        suggestedAction: "Assigner des SDRs pour ces jours",
      });
    } else {
      await clearConflict(prisma, { type: "MISSION_NOT_COVERED", missionId, month });
    }
  }

  // 2. DAILY_OVERCAPACITY: totalAssigned > 1.0 on specific date for an SDR
  const overloadedBySdr = new Map<string, string[]>();
  for (let si = 0; si < sdrIds.length; si++) {
    const sdrId = sdrIds[si];
    const sdrName = sdrNames[sdrId] ?? sdrId;
    const row = cells[si];
    const dates: string[] = [];
    for (let di = 0; di < row.length; di++) {
      const cell = row[di];
      if (cell.totalAssigned > 1.0 && !cell.isAbsent) {
        dates.push(dateToKey(cell.date));
      }
    }
    if (dates.length > 0) {
      overloadedBySdr.set(sdrId, dates);
      await upsertConflict(prisma, {
        type: "DAILY_OVERCAPACITY",
        severity: "P0",
        sdrId,
        month,
        message: `${sdrName} — surcharge quotidienne le(s) ${dates.slice(0, 3).join(", ")}${dates.length > 3 ? "…" : ""}`,
        suggestedAction: "Rééquilibrer les blocs sur ces jours",
      });
    } else {
      await clearConflict(prisma, { type: "DAILY_OVERCAPACITY", sdrId, month });
    }
  }

  // 3. SDR_DOUBLE_BOOKED_DAY: hasTimeOverlap (already covered by conflictEngine, but we can add from matrix)
  const doubleBookedBySdr = new Map<string, string[]>();
  for (let si = 0; si < sdrIds.length; si++) {
    const sdrId = sdrIds[si];
    const sdrName = sdrNames[sdrId] ?? sdrId;
    const row = cells[si];
    const dates: string[] = [];
    for (let di = 0; di < row.length; di++) {
      const cell = row[di];
      if (cell.hasTimeOverlap) {
        dates.push(dateToKey(cell.date));
      }
    }
    if (dates.length > 0) {
      doubleBookedBySdr.set(sdrId, dates);
      await upsertConflict(prisma, {
        type: "SDR_DOUBLE_BOOKED_DAY",
        severity: "P0",
        sdrId,
        month,
        message: `${sdrName} — créneaux qui se chevauchent le(s) ${dates.slice(0, 3).join(", ")}${dates.length > 3 ? "…" : ""}`,
        suggestedAction: "Vérifier et corriger les blocs en conflit",
      });
    } else {
      await clearConflict(prisma, { type: "SDR_DOUBLE_BOOKED_DAY", sdrId, month });
    }
  }

  // 4. PHANTOM_ALLOCATION: ScheduleBlocks outside mission startDate/endDate
  const phantoms = await prisma.scheduleBlock.findMany({
    where: {
      date: { gte: matrix.workingDays[0], lte: matrix.workingDays[matrix.workingDays.length - 1] },
      status: { not: "CANCELLED" },
      OR: [{ suggestionStatus: null }, { suggestionStatus: "CONFIRMED" }],
    },
    include: {
      mission: { select: { id: true, name: true, startDate: true, endDate: true } },
      sdr: { select: { id: true, name: true } },
    },
  });

  const phantomByMission = new Map<string, { count: number; sdrNames: string[] }>();
  for (const b of phantoms) {
    const start = new Date(b.mission.startDate);
    const end = new Date(b.mission.endDate);
    const d = new Date(b.date);
    if (d < start || d > end) {
      const key = b.missionId;
      const existing = phantomByMission.get(key) ?? { count: 0, sdrNames: [] };
      existing.count++;
      if (!existing.sdrNames.includes(b.sdr.name)) {
        existing.sdrNames.push(b.sdr.name);
      }
      phantomByMission.set(key, existing);
    }
  }

  for (const [missionId, info] of phantomByMission) {
    const missionName = missionNames[missionId] ?? missionId;
    await upsertConflict(prisma, {
      type: "PHANTOM_ALLOCATION",
      severity: "P1",
      missionId,
      month,
      message: `${info.count} bloc(s) fantôme(s) — ${info.sdrNames.join(", ")} sur ${missionName}`,
      suggestedAction: "Supprimer les blocs hors fenêtre mission",
    });
  }

  for (const mid of missionIds) {
    if (!phantomByMission.has(mid)) {
      await clearConflict(prisma, { type: "PHANTOM_ALLOCATION", missionId: mid, month });
    }
  }
}
