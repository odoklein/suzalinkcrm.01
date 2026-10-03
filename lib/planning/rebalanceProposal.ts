import type { PrismaClient, ScheduleBlock } from "@prisma/client";
import type { CapacityMatrix } from "./capacityMatrix";

// ============================================
// TYPES
// ============================================

export interface ProposalRow {
  date: Date;
  missionId: string;
  missionName: string;
  originalSdrId: string;
  originalBlock: ScheduleBlock & {
    mission: { id: string; name: string };
  };
  proposedSdrId: string | null;
  proposedTime: { start: string; end: string } | null;
  status: "AUTO_RESOLVED" | "OVERLOAD_WARNING" | "UNRESOLVED";
  overloadDelta?: number;
}

export interface RebalanceProposal {
  cause: string;
  affectedDays: number;
  rows: ProposalRow[];
  summary: {
    autoResolved: number;
    overloadWarns: number;
    unresolved: number;
  };
}

// ISO weekday: 1=Mon..5=Fri
function getISOWeekday(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

function dateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

// ============================================
// computeRebalanceProposal
// ============================================

export async function computeRebalanceProposal(
  params: {
    absentSdrId: string;
    absenceDates: Date[];
    affectedMissionIds: string[];
    month: string;
    prisma: PrismaClient;
    currentMatrix?: CapacityMatrix | null;
  }
): Promise<RebalanceProposal> {
  const {
    absentSdrId,
    absenceDates,
    affectedMissionIds,
    month,
    prisma,
    currentMatrix,
  } = params;

  const [year, m] = month.split("-").map(Number);
  const monthStart = new Date(year, m - 1, 1);
  const monthEnd = new Date(year, m, 0);

  const absenceDateSet = new Set(absenceDates.map((d) => dateToKey(d)));

  const blocks = await prisma.scheduleBlock.findMany({
    where: {
      sdrId: absentSdrId,
      missionId: { in: affectedMissionIds },
      date: { gte: monthStart, lte: monthEnd },
      status: { not: "CANCELLED" },
      OR: [{ suggestionStatus: null }, { suggestionStatus: "CONFIRMED" }],
    },
    include: {
      mission: { select: { id: true, name: true } },
    },
  });

  const absences = await prisma.sdrAbsence.findMany({
    where: {
      sdrId: { not: absentSdrId },
      impactsPlanning: true,
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
    },
  });

  const availabilities = await prisma.sdrMissionAvailability.findMany({
    where: {
      sdrId: { not: absentSdrId },
      missionId: { in: affectedMissionIds },
      month,
    },
  });

  const otherSdrBlocks = await prisma.scheduleBlock.findMany({
    where: {
      sdrId: { not: absentSdrId },
      missionId: { in: affectedMissionIds },
      date: { gte: monthStart, lte: monthEnd },
      status: { not: "CANCELLED" },
    },
  });

  const sdrsOnMissions = await prisma.user.findMany({
    where: {
      id: { not: absentSdrId },
      assignedMissions: {
        some: { missionId: { in: affectedMissionIds } },
      },
      isActive: true,
      role: { in: ["SDR", "BUSINESS_DEVELOPER"] },
    },
    select: { id: true, name: true },
  });

  const absentBySdrDate: Record<string, boolean> = {};
  for (const a of absences) {
    const cur = new Date(a.startDate);
    const end = new Date(a.endDate);
    while (cur <= end) {
      absentBySdrDate[`${a.sdrId}:${dateToKey(cur)}`] = true;
      cur.setDate(cur.getDate() + 1);
    }
  }

  const availBySdrMission: Record<string, Record<number, number>> = {};
  for (const av of availabilities) {
    const key = `${av.sdrId}:${av.missionId}`;
    const pattern = (av.weeklyPattern as Record<string, number>) ?? {};
    availBySdrMission[key] = {};
    for (let d = 1; d <= 5; d++) {
      availBySdrMission[key][d] = pattern[String(d)] ?? 1;
    }
  }

  const blocksBySdrDate: Record<string, typeof otherSdrBlocks> = {};
  for (const b of otherSdrBlocks) {
    const key = `${b.sdrId}:${dateToKey(b.date)}`;
    if (!blocksBySdrDate[key]) blocksBySdrDate[key] = [];
    blocksBySdrDate[key].push(b);
  }

  const getLoadOnDate = (sdrId: string, date: Date): number => {
    if (currentMatrix) {
      const si = currentMatrix.sdrIds.indexOf(sdrId);
      const di = currentMatrix.workingDays.findIndex(
        (wd) => dateToKey(wd) === dateToKey(date)
      );
      if (si >= 0 && di >= 0) {
        return currentMatrix.cells[si][di]?.totalAssigned ?? 0;
      }
    }
    const dayBlocks = blocksBySdrDate[`${sdrId}:${dateToKey(date)}`] ?? [];
    let total = 0;
    for (const b of dayBlocks) {
      total += (parseInt(b.endTime.slice(0, 2)) * 60 + parseInt(b.endTime.slice(3))) -
        (parseInt(b.startTime.slice(0, 2)) * 60 + parseInt(b.startTime.slice(3)));
    }
    return total / 480;
  };

  const rows: ProposalRow[] = [];

  for (const block of blocks) {
    const blockDate = block.date;
    const dateStr = dateToKey(blockDate);
    if (!absenceDateSet.has(dateStr)) continue;

    const missionId = block.missionId;
    const dow = getISOWeekday(blockDate);

    const candidates = sdrsOnMissions.filter((s) => {
      if (s.id === absentSdrId) return false;
      if (absentBySdrDate[`${s.id}:${dateStr}`]) return false;
      const avKey = `${s.id}:${missionId}`;
      const cap = availBySdrMission[avKey]?.[dow] ?? 1;
      if (cap <= 0) return false;
      const dayBlocks = blocksBySdrDate[`${s.id}:${dateStr}`] ?? [];
      for (const ob of dayBlocks) {
        if (overlaps(block.startTime, block.endTime, ob.startTime, ob.endTime))
          return false;
      }
      return true;
    });

    const blockFraction =
      (parseInt(block.endTime.slice(0, 2)) * 60 + parseInt(block.endTime.slice(3)) -
        (parseInt(block.startTime.slice(0, 2)) * 60 + parseInt(block.startTime.slice(3)))) /
      480;

    const scored = candidates.map((c) => ({
      sdrId: c.id,
      load: getLoadOnDate(c.id, blockDate),
    }));
    scored.sort((a, b) => a.load - b.load);

    let proposedSdrId: string | null = null;
    let status: ProposalRow["status"] = "UNRESOLVED";
    let overloadDelta: number | undefined;

    if (scored.length > 0) {
      const best = scored[0];
      const newLoad = best.load + blockFraction;
      proposedSdrId = best.sdrId;
      if (newLoad <= 1.0) {
        status = "AUTO_RESOLVED";
      } else {
        status = "OVERLOAD_WARNING";
        overloadDelta = Math.round((newLoad - 1) * 10) / 10;
      }
    }

    rows.push({
      date: blockDate,
      missionId,
      missionName: block.mission.name,
      originalSdrId: absentSdrId,
      originalBlock: block,
      proposedSdrId,
      proposedTime:
        proposedSdrId != null
          ? { start: block.startTime, end: block.endTime }
          : null,
      status,
      overloadDelta,
    });
  }

  const summary = {
    autoResolved: rows.filter((r) => r.status === "AUTO_RESOLVED").length,
    overloadWarns: rows.filter((r) => r.status === "OVERLOAD_WARNING").length,
    unresolved: rows.filter((r) => r.status === "UNRESOLVED").length,
  };

  const affectedDays = new Set(rows.map((r) => dateToKey(r.date))).size;

  return {
    cause: `Absence de l'SDR sur ${affectedDays} jour(s)`,
    affectedDays,
    rows,
    summary,
  };
}
