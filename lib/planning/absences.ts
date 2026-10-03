import { prisma } from "@/lib/prisma";

// Date helpers — all dates are compared by YYYY-MM-DD (local) to avoid TZ off-by-one.

export function toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * Return whether an SDR has an absence that impacts planning on the given date.
 * Inclusive on both startDate and endDate. Only absences with impactsPlanning=true block.
 */
export async function isSdrAbsentOnDate(sdrId: string, date: Date): Promise<boolean> {
    const key = toDateKey(date);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const absence = await prisma.sdrAbsence.findFirst({
        where: {
            sdrId,
            impactsPlanning: true,
            startDate: { lte: dayEnd },
            endDate: { gte: dayStart },
        },
        select: { id: true, startDate: true, endDate: true, type: true },
    });
    if (!absence) return false;

    // Defensive double-check on the date key (Prisma compares Date but we want pure date semantics).
    const absStart = toDateKey(absence.startDate);
    const absEnd = toDateKey(absence.endDate);
    return key >= absStart && key <= absEnd;
}

/**
 * Bulk-build a Set of "sdrId:YYYY-MM-DD" keys representing every absent day in [from, to].
 * Use this in loops to avoid N+1 queries.
 */
export async function buildAbsenceDayKeySet(opts: {
    sdrIds?: string[];
    from: Date;
    to: Date;
}): Promise<Set<string>> {
    const { sdrIds, from, to } = opts;
    const absences = await prisma.sdrAbsence.findMany({
        where: {
            impactsPlanning: true,
            ...(sdrIds && sdrIds.length > 0 ? { sdrId: { in: sdrIds } } : {}),
            startDate: { lte: to },
            endDate: { gte: from },
        },
        select: { sdrId: true, startDate: true, endDate: true },
    });

    const result = new Set<string>();
    const rangeStart = new Date(from);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(to);
    rangeEnd.setHours(0, 0, 0, 0);

    for (const a of absences) {
        const cur = new Date(Math.max(a.startDate.getTime(), rangeStart.getTime()));
        cur.setHours(0, 0, 0, 0);
        const end = new Date(Math.min(a.endDate.getTime(), rangeEnd.getTime()));
        end.setHours(0, 0, 0, 0);
        while (cur.getTime() <= end.getTime()) {
            result.add(`${a.sdrId}:${toDateKey(cur)}`);
            cur.setDate(cur.getDate() + 1);
        }
    }
    return result;
}
