import type { PrismaClient, PlanningConflict } from "@prisma/client";
import { overlaps } from "./conflictDetection";

// ============================================
// TYPES
// ============================================

export type CellState =
  | "HEALTHY"      // 1/1 green
  | "OVERLOADED"   // 2/1 amber — no time overlap
  | "CONFLICT"     // 2/1 red — time overlap exists
  | "ABSENT"       // ABS hatched
  | "NON_WORKING"  // — grey (pattern says 0 this weekday)
  | "PRE_MISSION"  // Ø faded (before mission startDate)
  | "POST_MISSION" // Ø faded (after mission endDate)
  | "UNASSIGNED";  // 0/1 dashed

export interface MissionBlock {
  missionId: string;
  missionName: string;
  missionColor: string;
  blockId: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  fraction: number;
  isConfirmed: boolean;
  isProposed: boolean;
}

export interface GridCell {
  date: Date;
  sdrId: string;
  capacity: number;
  isAbsent: boolean;
  isNonWorking: boolean;
  assignedBlocks: MissionBlock[];
  totalAssigned: number;
  hasTimeOverlap: boolean;
  cellState: CellState;
  conflicts: { type: string; severity: "CRITIQUE" | "ATTENTION" | "INFO"; message: string }[];
}

export interface MissionCoverageCell {
  date: Date;
  missionId: string;
  sdrCount: number;
  targetCount: number;
  isPreStart: boolean;
  isPostEnd: boolean;
}

export interface ProposedChange {
  blockId: string;
  fromSdrId: string;
  toSdrId: string;
  date: string;
  missionId: string;
}

export interface CapacityMatrix {
  month: string;
  workingDays: Date[];
  sdrIds: string[];
  missionIds: string[];
  sdrNames: Record<string, string>;
  missionNames: Record<string, string>;
  missionColors: Record<string, string>;
  cells: GridCell[][];
  missionCoverage: MissionCoverageCell[][];
  conflicts: PlanningConflict[];
}

// ISO weekday: 1=Mon..5=Fri, 0=Sun, 6=Sat
function getISOWeekday(d: Date): number {
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  return day === 0 ? 7 : day;
}

function dateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseTimeToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function blockFraction(startTime: string, endTime: string): number {
  const mins = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  return mins / 480; // 8h = 1.0j
}

// ============================================
// getWorkingDays
// ============================================

export async function getWorkingDays(
  month: string,
  prisma: PrismaClient,
  weekdays: number[] = [1, 2, 3, 4, 5]
): Promise<Date[]> {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 0);

  const holidays = await prisma.planningHoliday.findMany({
    where: {
      date: { gte: start, lte: end },
      scope: "GLOBAL",
    },
  });
  const holidaySet = new Set(holidays.map((h) => dateToKey(h.date)));

  const result: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const dow = getISOWeekday(cur);
    if (weekdays.includes(dow) && !holidaySet.has(dateToKey(cur))) {
      result.push(new Date(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

// ============================================
// buildCapacityMatrix
// ============================================

const MISSION_COLORS = [
  "#818cf8",
  "#f472b6",
  "#34d399",
  "#fb923c",
  "#60a5fa",
  "#a78bfa",
  "#4ade80",
  "#f87171",
];

export async function buildCapacityMatrix(
  month: string,
  sdrIds: string[],
  missionIds: string[],
  prisma: PrismaClient,
  proposedChanges?: ProposedChange[]
): Promise<CapacityMatrix> {
  const [year, m] = month.split("-").map(Number);
  const monthStart = new Date(year, m - 1, 1);
  const monthEnd = new Date(year, m, 0);

  const workingDays = await getWorkingDays(month, prisma);

  const missionColors: Record<string, string> = {};
  missionIds.forEach((id, i) => {
    missionColors[id] = MISSION_COLORS[i % MISSION_COLORS.length];
  });

  // Fetch all data in parallel
  const [
    missionMonthPlans,
    absences,
    overrides,
    availabilities,
    blocks,
    sdrUsers,
    missionData,
  ] = await Promise.all([
    prisma.missionMonthPlan.findMany({
      where: { missionId: { in: missionIds }, month },
      select: {
        id: true,
        missionId: true,
        targetDays: true,
        workingDays: true,
      },
    }),
    prisma.sdrAbsence.findMany({
      where: {
        sdrId: { in: sdrIds },
        impactsPlanning: true,
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
    }),
    prisma.sdrDayOverride.findMany({
      where: {
        sdrId: { in: sdrIds },
        date: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.sdrMissionAvailability.findMany({
      where: {
        sdrId: { in: sdrIds },
        missionId: { in: missionIds },
        month,
      },
    }),
    prisma.scheduleBlock.findMany({
      where: {
        sdrId: { in: sdrIds },
        missionId: { in: missionIds },
        date: { gte: monthStart, lte: monthEnd },
        status: { not: "CANCELLED" },
        OR: [
          { suggestionStatus: null },
          { suggestionStatus: "SUGGESTED" },
          { suggestionStatus: "CONFIRMED" },
        ],
      },
      include: {
        mission: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
    }),
    prisma.user.findMany({
      where: { id: { in: sdrIds } },
      select: { id: true, name: true },
    }),
    prisma.mission.findMany({
      where: { id: { in: missionIds } },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
  ]);

  const sdrNames: Record<string, string> = Object.fromEntries(
    sdrUsers.map((u) => [u.id, u.name])
  );
  const missionNames: Record<string, string> = Object.fromEntries(
    missionData.map((m) => [m.id, m.name])
  );
  const missionDates: Record<string, { start: Date; end: Date }> = Object.fromEntries(
    missionData.map((m) => [
      m.id,
      {
        start: new Date(m.startDate),
        end: new Date(m.endDate),
      },
    ])
  );

  const overrideBySdrDate: Record<string, number> = {};
  for (const o of overrides) {
    const dateStr = dateToKey(o.date);
    if (o.missionId == null) {
      overrideBySdrDate[`${o.sdrId}:${dateStr}`] = o.capacity;
    } else {
      overrideBySdrDate[`${o.sdrId}:${dateStr}:${o.missionId}`] = o.capacity;
    }
  }

  const absenceBySdrDate: Record<string, boolean> = {};
  for (const a of absences) {
    const cur = new Date(a.startDate);
    const end = new Date(a.endDate);
    while (cur <= end) {
      for (const sdrId of sdrIds) {
        if (a.sdrId === sdrId) {
          absenceBySdrDate[`${sdrId}:${dateToKey(cur)}`] = true;
        }
      }
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

  const blocksBySdrDate: Record<string, typeof blocks> = {};
  for (const b of blocks) {
    const key = `${b.sdrId}:${dateToKey(b.date)}`;
    if (!blocksBySdrDate[key]) blocksBySdrDate[key] = [];
    blocksBySdrDate[key].push(b);
  }

  const workingDaysCount = workingDays.length;
  const targetByMission: Record<string, number> = {};
  for (const p of missionMonthPlans) {
    targetByMission[p.missionId] = Math.ceil(p.targetDays / Math.max(1, workingDaysCount));
  }

  const cells: GridCell[][] = [];
  for (let si = 0; si < sdrIds.length; si++) {
    const sdrId = sdrIds[si];
    const row: GridCell[] = [];
    for (let di = 0; di < workingDays.length; di++) {
      const date = workingDays[di];
      const dateStr = dateToKey(date);
      const dow = getISOWeekday(date);

      let capacity = 1.0;
      let isAbsent = !!absenceBySdrDate[`${sdrId}:${dateStr}`];
      let isNonWorking = false;

      if (isAbsent) {
        capacity = 0;
      } else {
        const overrideGlobal = overrideBySdrDate[`${sdrId}:${dateStr}`];
        if (overrideGlobal !== undefined) {
          capacity = overrideGlobal;
        } else {
          for (const missionId of missionIds) {
            const overrideKey = `${sdrId}:${dateStr}:${missionId}`;
            if (overrideKey in overrideBySdrDate) {
              capacity = overrideBySdrDate[overrideKey];
              break;
            }
          }
        }
        if (!isAbsent && capacity === 1.0) {
          let maxCap = 0;
          for (const missionId of missionIds) {
            const avKey = `${sdrId}:${missionId}`;
            if (avKey in availBySdrMission) {
              const cap = availBySdrMission[avKey][dow] ?? 0;
              maxCap = Math.max(maxCap, cap);
            }
          }
          if (Object.keys(availBySdrMission).some((k) => k.startsWith(`${sdrId}:`))) {
            capacity = maxCap > 0 ? maxCap : 0;
            if (capacity === 0) isNonWorking = true;
          }
        }
      }

      const dayBlocks = blocksBySdrDate[`${sdrId}:${dateStr}`] ?? [];
      const missionBlocks: MissionBlock[] = dayBlocks.map((b) => {
        const dates = missionDates[b.missionId];
        const isInWindow =
          dates &&
          date >= dates.start &&
          date <= dates.end;
        const isConfirmed =
          b.suggestionStatus === null || b.suggestionStatus === "CONFIRMED";
        const frac = blockFraction(b.startTime, b.endTime);
        return {
          missionId: b.missionId,
          missionName: b.mission.name,
          missionColor: missionColors[b.missionId] ?? "#6366f1",
          blockId: b.id,
          timeStart: b.startTime,
          timeEnd: b.endTime,
          fraction: frac,
          isConfirmed,
          isProposed: b.suggestionStatus === "SUGGESTED",
        };
      });

      let hasTimeOverlap = false;
      for (let i = 0; i < dayBlocks.length; i++) {
        for (let j = i + 1; j < dayBlocks.length; j++) {
          const a = dayBlocks[i];
          const b = dayBlocks[j];
          if (overlaps(a.startTime, a.endTime, b.startTime, b.endTime)) {
            hasTimeOverlap = true;
            break;
          }
        }
        if (hasTimeOverlap) break;
      }

      const totalAssigned = missionBlocks.reduce((s, b) => s + b.fraction, 0);

      let cellState: CellState;
      if (isAbsent) {
        cellState = "ABSENT";
      } else if (isNonWorking || capacity === 0) {
        cellState = "NON_WORKING";
      } else if (totalAssigned === 0) {
        cellState = "UNASSIGNED";
      } else if (hasTimeOverlap) {
        cellState = "CONFLICT";
      } else if (totalAssigned > capacity) {
        cellState = "OVERLOADED";
      } else {
        cellState = "HEALTHY";
      }

      row.push({
        date,
        sdrId,
        capacity,
        isAbsent,
        isNonWorking,
        assignedBlocks: missionBlocks,
        totalAssigned,
        hasTimeOverlap,
        cellState,
        conflicts: [],
      });
    }
    cells.push(row);
  }

  const missionCoverage: MissionCoverageCell[][] = [];
  for (let mi = 0; mi < missionIds.length; mi++) {
    const missionId = missionIds[mi];
    const dates = missionDates[missionId];
    const targetCount = targetByMission[missionId] ?? 0;
    const row: MissionCoverageCell[] = [];
    for (let di = 0; di < workingDays.length; di++) {
      const date = workingDays[di];
      const isPreStart = dates ? date < dates.start : false;
      const isPostEnd = dates ? date > dates.end : false;
      let sdrCount = 0;
      for (let si = 0; si < sdrIds.length; si++) {
        const cell = cells[si][di];
        const hasBlock = cell.assignedBlocks.some(
          (b) =>
            b.missionId === missionId &&
            (b.isConfirmed || b.isProposed)
        );
        if (hasBlock) sdrCount++;
      }
      row.push({
        date,
        missionId,
        sdrCount,
        targetCount,
        isPreStart,
        isPostEnd,
      });
    }
    missionCoverage.push(row);
  }

  const conflicts = await prisma.planningConflict.findMany({
    where: { month, resolvedAt: null },
    orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
  });

  return {
    month,
    workingDays,
    sdrIds,
    missionIds,
    sdrNames,
    missionNames,
    missionColors,
    cells,
    missionCoverage,
    conflicts,
  };
}
