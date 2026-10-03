import { PrismaClient } from '@prisma/client';

const DAY_OFFSET: Record<string, number> = {
    MONDAY: 0,
    TUESDAY: 1,
    WEDNESDAY: 2,
    THURSDAY: 3,
    FRIDAY: 4,
};

function getTimeSlot(plan: {
    timePreference: string;
    customStartTime: string | null;
    customEndTime: string | null;
}): { startTime: string; endTime: string } {
    switch (plan.timePreference) {
        case 'MORNING':
            return { startTime: '08:00', endTime: '12:00' };
        case 'AFTERNOON':
            return { startTime: '14:00', endTime: '18:00' };
        case 'FULL_DAY':
            return { startTime: '08:00', endTime: '18:00' };
        case 'CUSTOM':
            return {
                startTime: plan.customStartTime ?? '08:00',
                endTime: plan.customEndTime ?? '12:00',
            };
        default:
            return { startTime: '08:00', endTime: '12:00' };
    }
}

function overlaps(
    aStart: string,
    aEnd: string,
    bStart: string,
    bEnd: string
): boolean {
    return aStart < bEnd && aEnd > bStart;
}

function getMonday(d: Date): Date {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function addDays(d: Date, days: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + days);
    return out;
}

export async function generateSuggestedBlocks(
    prisma: PrismaClient,
    planId: string,
    createdById: string
): Promise<{ generated: number; conflicts: number }> {
    const plan = await prisma.missionPlan.findUnique({
        where: { id: planId },
        include: {
            mission: true,
            assignedSdrs: { orderBy: { createdAt: 'asc' } },
        },
    });

    if (!plan || plan.assignedSdrs.length === 0) {
        return { generated: 0, conflicts: 0 };
    }

    const sdrIds = plan.assignedSdrs.map((a) => a.sdrId);
    const { startTime: slotStart, endTime: slotEnd } = getTimeSlot(plan);

    const startDate = new Date(plan.startDate);
    const endDate = plan.endDate
        ? new Date(plan.endDate)
        : addDays(startDate, 4 * 7);
    const planStartMonday = getMonday(startDate);
    const planEndMonday = getMonday(endDate);

    const rangeStart = planStartMonday.getTime() <= startDate.getTime()
        ? startDate
        : planStartMonday;
    const rangeEnd = endDate;

    await prisma.scheduleBlock.deleteMany({
        where: {
            missionPlanId: planId,
            suggestionStatus: 'SUGGESTED',
            date: { gte: rangeStart, lte: rangeEnd },
        },
    });

    let generated = 0;
    let conflicts = 0;

    const confirmedBlocksBySdr = await prisma.scheduleBlock.findMany({
        where: {
            sdrId: { in: sdrIds },
            date: { gte: rangeStart, lte: rangeEnd },
            status: { not: 'CANCELLED' },
            OR: [
                { suggestionStatus: 'CONFIRMED' },
                { suggestionStatus: null },
            ],
        },
        select: { sdrId: true, date: true, startTime: true, endTime: true },
    });

    const createdInRun: Array<{ sdrId: string; date: Date; startTime: string; endTime: string }> = [];

    const isSlotFree = (sdrId: string, date: Date, start: string, end: string): boolean => {
        const dateStr = date.toISOString().slice(0, 10);
        const conflictsWithConfirmed = confirmedBlocksBySdr.some(
            (b) =>
                b.sdrId === sdrId &&
                b.date.toISOString().slice(0, 10) === dateStr &&
                overlaps(b.startTime, b.endTime, start, end)
        );
        if (conflictsWithConfirmed) return false;
        const conflictsWithCreated = createdInRun.some(
            (b) =>
                b.sdrId === sdrId &&
                b.date.toISOString().slice(0, 10) === dateStr &&
                overlaps(b.startTime, b.endTime, start, end)
        );
        return !conflictsWithCreated;
    };

    let sdrIndex = 0;
    const weeks: Date[] = [];
    for (let m = new Date(planStartMonday); m <= planEndMonday; m.setDate(m.getDate() + 7)) {
        weeks.push(new Date(m));
    }

    for (const weekStart of weeks) {
        for (const dayOfWeek of plan.preferredDays) {
            const dayOffset = DAY_OFFSET[dayOfWeek] ?? 0;
            const slotDate = addDays(weekStart, dayOffset);
            if (slotDate < rangeStart || slotDate > rangeEnd) continue;

            const slotDateNorm = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate(), 0, 0, 0, 0);
            let assigned = false;
            for (let i = 0; i < sdrIds.length; i++) {
                const idx = (sdrIndex + i) % sdrIds.length;
                const sdrId = sdrIds[idx];
                if (isSlotFree(sdrId, slotDateNorm, slotStart, slotEnd)) {
                    await prisma.scheduleBlock.create({
                        data: {
                            sdrId,
                            missionId: plan.missionId,
                            date: slotDateNorm,
                            startTime: slotStart,
                            endTime: slotEnd,
                            status: 'SCHEDULED',
                            suggestionStatus: 'SUGGESTED',
                            missionPlanId: planId,
                            generatedAt: new Date(),
                            createdById,
                        },
                    });
                    createdInRun.push({
                        sdrId,
                        date: slotDateNorm,
                        startTime: slotStart,
                        endTime: slotEnd,
                    });
                    generated++;
                    sdrIndex = (idx + 1) % sdrIds.length;
                    assigned = true;
                    break;
                }
            }
            if (!assigned) conflicts++;
        }
    }

    return { generated, conflicts };
}
