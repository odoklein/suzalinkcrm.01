import { prisma } from '@/lib/prisma';
import { ConflictType, ConflictSeverity, Prisma } from '@prisma/client';

export interface ConflictScope {
    sdrId?: string;
    missionId?: string;
    month: string; // "2025-10"
}

// ============================================
// Helper: format month "2025-10" → Date range
// ============================================
function monthToDateRange(month: string): { start: Date; end: Date } {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0); // last day of month
    return { start, end };
}

// ============================================
// Helper: count absence days in month that impact planning
// ============================================
async function countAbsenceDaysInMonth(sdrId: string, month: string): Promise<number> {
    const { start, end } = monthToDateRange(month);
    const absences = await prisma.sdrAbsence.findMany({
        where: {
            sdrId,
            impactsPlanning: true,
            startDate: { lte: end },
            endDate: { gte: start },
        },
    });

    let totalDays = 0;
    for (const abs of absences) {
        const absStart = abs.startDate > start ? abs.startDate : start;
        const absEnd = abs.endDate < end ? abs.endDate : end;
        const msPerDay = 86400000;
        const days = Math.round((absEnd.getTime() - absStart.getTime()) / msPerDay) + 1;
        totalDays += Math.max(0, days);
    }
    return totalDays;
}

// ============================================
// Helper: upsert or delete a conflict
// ============================================
async function upsertConflict(params: {
    type: ConflictType;
    severity: ConflictSeverity;
    sdrId?: string | null;
    missionId?: string | null;
    month: string;
    message: string;
    suggestedAction?: string | null;
}) {
    // Use a composite lookup to avoid duplicates per type+sdr+mission+month
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

async function clearConflict(params: {
    type: ConflictType;
    sdrId?: string | null;
    missionId?: string | null;
    month: string;
}) {
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

// ============================================
// MAIN: recomputeConflicts
// ============================================
export async function recomputeConflicts(scope: ConflictScope): Promise<void> {
    const { month } = scope;
    const { start: monthStart, end: monthEnd } = monthToDateRange(month);

    // --- SDR-scoped checks ---
    if (scope.sdrId) {
        await checkSdrOverloadedMonth(scope.sdrId, month);
        await checkSdrNearCapacity(scope.sdrId, month);
        await checkSdrUnderutilized(scope.sdrId, month);
        await checkAbsenceConflictsBlock(scope.sdrId, month, monthStart, monthEnd);
        await checkAllocationNotScheduled(scope.sdrId, month);
    }

    // --- Mission-scoped checks ---
    if (scope.missionId) {
        await checkMissionNoSdr(scope.missionId, month);
        await checkMissionUnderstaffed(scope.missionId, month);
        await checkMissionOverstaffed(scope.missionId, month);
        await checkContractNotFullyPlanned(scope.missionId, month);
        await checkMissionEndingUnplanned(scope.missionId, month);
        await checkNoplanForActiveMonth(scope.missionId, month, monthStart, monthEnd);
    }

    // --- Double-booked day (needs both sdrId for scope) ---
    if (scope.sdrId) {
        await checkSdrDoubleBookedDay(scope.sdrId, month, monthStart, monthEnd);
    }
}

// ============================================
// P0 — SDR_OVERLOADED_MONTH
// ============================================
async function checkSdrOverloadedMonth(sdrId: string, month: string) {
    const capacity = await prisma.sdrMonthCapacity.findUnique({
        where: { sdrId_month: { sdrId, month } },
    });

    if (!capacity) {
        await clearConflict({ type: 'SDR_OVERLOADED_MONTH', sdrId, month });
        return;
    }

    const allocs = await prisma.sdrDayAllocation.findMany({
        where: {
            sdrId,
            missionMonthPlan: { month },
        },
    });

    const totalAllocated = allocs.reduce((s, a) => s + a.allocatedDays, 0);

    if (totalAllocated > capacity.effectiveAvailableDays) {
        const sdr = await prisma.user.findUnique({ where: { id: sdrId }, select: { name: true } });
        const excess = totalAllocated - capacity.effectiveAvailableDays;
        await upsertConflict({
            type: 'SDR_OVERLOADED_MONTH',
            severity: 'P0',
            sdrId,
            month,
            message: `${sdr?.name ?? sdrId} est surchargé — ${totalAllocated}j alloués pour ${capacity.effectiveAvailableDays}j disponibles`,
            suggestedAction: `Réduire de ${excess}j sur une ou plusieurs missions`,
        });
    } else {
        await clearConflict({ type: 'SDR_OVERLOADED_MONTH', sdrId, month });
    }
}

// ============================================
// P0 — SDR_DOUBLE_BOOKED_DAY
// ============================================
async function checkSdrDoubleBookedDay(sdrId: string, month: string, monthStart: Date, monthEnd: Date) {
    const blocks = await prisma.scheduleBlock.findMany({
        where: {
            sdrId,
            date: { gte: monthStart, lte: monthEnd },
            status: { not: 'CANCELLED' },
            OR: [{ suggestionStatus: null }, { suggestionStatus: 'CONFIRMED' }],
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    // Group by date
    const byDate: Record<string, typeof blocks> = {};
    for (const b of blocks) {
        const key = b.date.toISOString().slice(0, 10);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(b);
    }

    let hasDouble = false;
    const conflictDates: string[] = [];

    for (const [date, dayBlocks] of Object.entries(byDate)) {
        for (let i = 0; i < dayBlocks.length; i++) {
            for (let j = i + 1; j < dayBlocks.length; j++) {
                const a = dayBlocks[i];
                const b = dayBlocks[j];
                if (a.startTime < b.endTime && a.endTime > b.startTime) {
                    hasDouble = true;
                    conflictDates.push(date);
                }
            }
        }
    }

    if (hasDouble) {
        const sdr = await prisma.user.findUnique({ where: { id: sdrId }, select: { name: true } });
        const unique = [...new Set(conflictDates)];
        await upsertConflict({
            type: 'SDR_DOUBLE_BOOKED_DAY',
            severity: 'P0',
            sdrId,
            month,
            message: `${sdr?.name ?? sdrId} a des créneaux qui se chevauchent le${unique.length > 1 ? 's' : ''} ${unique.join(', ')}`,
            suggestedAction: 'Vérifier et corriger les blocs en conflit',
        });
    } else {
        await clearConflict({ type: 'SDR_DOUBLE_BOOKED_DAY', sdrId, month });
    }
}

// ============================================
// P0 — MISSION_NO_SDR
// ============================================
async function checkMissionNoSdr(missionId: string, month: string) {
    const plan = await prisma.missionMonthPlan.findUnique({
        where: { missionId_month: { missionId, month } },
        include: { allocations: true },
    });

    if (!plan) {
        await clearConflict({ type: 'MISSION_NO_SDR', missionId, month });
        return;
    }

    const hasAllocations = plan.allocations.length > 0 && plan.allocations.some((a) => a.allocatedDays > 0);

    if (plan.targetDays > 0 && !hasAllocations) {
        const mission = await prisma.mission.findUnique({ where: { id: missionId }, select: { name: true } });
        await upsertConflict({
            type: 'MISSION_NO_SDR',
            severity: 'P0',
            missionId,
            month,
            message: `${mission?.name ?? missionId} n'a aucun SDR affecté ce mois (${plan.targetDays}j à couvrir)`,
            suggestedAction: 'Affecter un SDR à cette mission',
        });
    } else {
        await clearConflict({ type: 'MISSION_NO_SDR', missionId, month });
    }
}

// ============================================
// P1 — MISSION_UNDERSTAFFED
// ============================================
async function checkMissionUnderstaffed(missionId: string, month: string) {
    const plan = await prisma.missionMonthPlan.findUnique({
        where: { missionId_month: { missionId, month } },
        include: { allocations: true },
    });

    if (!plan) {
        await clearConflict({ type: 'MISSION_UNDERSTAFFED', missionId, month });
        return;
    }

    const totalAllocated = plan.allocations.reduce((s, a) => s + a.allocatedDays, 0);

    if (totalAllocated < plan.targetDays && totalAllocated > 0) {
        const mission = await prisma.mission.findUnique({ where: { id: missionId }, select: { name: true } });
        const gap = plan.targetDays - totalAllocated;
        await upsertConflict({
            type: 'MISSION_UNDERSTAFFED',
            severity: 'P1',
            missionId,
            month,
            message: `${mission?.name ?? missionId} — ${gap}j non couverts (${totalAllocated}/${plan.targetDays}j)`,
            suggestedAction: `Allouer ${gap}j supplémentaires à un SDR disponible`,
        });
    } else {
        await clearConflict({ type: 'MISSION_UNDERSTAFFED', missionId, month });
    }
}

// ============================================
// P1 — MISSION_OVERSTAFFED
// ============================================
async function checkMissionOverstaffed(missionId: string, month: string) {
    const plan = await prisma.missionMonthPlan.findUnique({
        where: { missionId_month: { missionId, month } },
        include: { allocations: true },
    });

    if (!plan) {
        await clearConflict({ type: 'MISSION_OVERSTAFFED', missionId, month });
        return;
    }

    const totalAllocated = plan.allocations.reduce((s, a) => s + a.allocatedDays, 0);

    if (totalAllocated > plan.targetDays) {
        const mission = await prisma.mission.findUnique({ where: { id: missionId }, select: { name: true } });
        const excess = totalAllocated - plan.targetDays;
        await upsertConflict({
            type: 'MISSION_OVERSTAFFED',
            severity: 'P1',
            missionId,
            month,
            message: `${mission?.name ?? missionId} — dépassement de ${excess}j (${totalAllocated}/${plan.targetDays}j alloués)`,
            suggestedAction: `Réduire les allocations de ${excess}j`,
        });
    } else {
        await clearConflict({ type: 'MISSION_OVERSTAFFED', missionId, month });
    }
}

// ============================================
// P1 — SDR_NEAR_CAPACITY (>= 85%)
// ============================================
async function checkSdrNearCapacity(sdrId: string, month: string) {
    const capacity = await prisma.sdrMonthCapacity.findUnique({
        where: { sdrId_month: { sdrId, month } },
    });

    if (!capacity || capacity.effectiveAvailableDays === 0) {
        await clearConflict({ type: 'SDR_NEAR_CAPACITY', sdrId, month });
        return;
    }

    const allocs = await prisma.sdrDayAllocation.findMany({
        where: { sdrId, missionMonthPlan: { month } },
    });

    const totalAllocated = allocs.reduce((s, a) => s + a.allocatedDays, 0);
    const pct = totalAllocated / capacity.effectiveAvailableDays;

    // Only warn near capacity if NOT already overloaded (that's P0)
    if (pct >= 0.85 && pct <= 1.0) {
        const sdr = await prisma.user.findUnique({ where: { id: sdrId }, select: { name: true } });
        await upsertConflict({
            type: 'SDR_NEAR_CAPACITY',
            severity: 'P1',
            sdrId,
            month,
            message: `${sdr?.name ?? sdrId} est proche de sa capacité — ${totalAllocated}/${capacity.effectiveAvailableDays}j (${Math.round(pct * 100)}%)`,
            suggestedAction: 'Surveiller avant d\'ajouter d\'autres allocations',
        });
    } else {
        await clearConflict({ type: 'SDR_NEAR_CAPACITY', sdrId, month });
    }
}

// ============================================
// P1 — ALLOCATION_NOT_SCHEDULED
// ============================================
async function checkAllocationNotScheduled(sdrId: string, month: string) {
    const allocs = await prisma.sdrDayAllocation.findMany({
        where: {
            sdrId,
            missionMonthPlan: { month },
            allocatedDays: { gt: 0 },
            scheduledDays: 0,
        },
        include: {
            missionMonthPlan: {
                include: { mission: { select: { name: true } } },
            },
        },
    });

    if (allocs.length > 0) {
        const sdr = await prisma.user.findUnique({ where: { id: sdrId }, select: { name: true } });
        const missionNames = allocs.map((a) => a.missionMonthPlan.mission.name).join(', ');
        // Use first missionId as reference
        const missionId = allocs[0].missionMonthPlan.missionId;
        await upsertConflict({
            type: 'ALLOCATION_NOT_SCHEDULED',
            severity: 'P1',
            sdrId,
            missionId,
            month,
            message: `${sdr?.name ?? sdrId} — allocation sans blocs posés (${missionNames})`,
            suggestedAction: 'Placer les créneaux dans le calendrier',
        });
    } else {
        // Clear all for this SDR+month
        await prisma.planningConflict.updateMany({
            where: {
                type: 'ALLOCATION_NOT_SCHEDULED',
                sdrId,
                month,
                resolvedAt: null,
            },
            data: { resolvedAt: new Date() },
        });
    }
}

// ============================================
// P1 — ABSENCE_CONFLICTS_BLOCK
// ============================================
async function checkAbsenceConflictsBlock(sdrId: string, month: string, monthStart: Date, monthEnd: Date) {
    const absences = await prisma.sdrAbsence.findMany({
        where: {
            sdrId,
            impactsPlanning: true,
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart },
        },
    });

    if (absences.length === 0) {
        await clearConflict({ type: 'ABSENCE_CONFLICTS_BLOCK', sdrId, month });
        return;
    }

    const blocks = await prisma.scheduleBlock.findMany({
        where: {
            sdrId,
            date: { gte: monthStart, lte: monthEnd },
            status: { not: 'CANCELLED' },
        },
    });

    const conflicts: string[] = [];
    for (const block of blocks) {
        const blockDate = block.date;
        for (const abs of absences) {
            if (blockDate >= abs.startDate && blockDate <= abs.endDate) {
                conflicts.push(blockDate.toISOString().slice(0, 10));
                break;
            }
        }
    }

    if (conflicts.length > 0) {
        const sdr = await prisma.user.findUnique({ where: { id: sdrId }, select: { name: true } });
        const unique = [...new Set(conflicts)];
        await upsertConflict({
            type: 'ABSENCE_CONFLICTS_BLOCK',
            severity: 'P1',
            sdrId,
            month,
            message: `${sdr?.name ?? sdrId} a des blocs posés sur des jours d'absence (${unique.slice(0, 3).join(', ')}${unique.length > 3 ? '…' : ''})`,
            suggestedAction: 'Déplacer ou annuler les blocs concernés',
        });
    } else {
        await clearConflict({ type: 'ABSENCE_CONFLICTS_BLOCK', sdrId, month });
    }
}

// ============================================
// P2 — CONTRACT_NOT_FULLY_PLANNED
// ============================================
async function checkContractNotFullyPlanned(missionId: string, month: string) {
    const mission = await prisma.mission.findUnique({
        where: { id: missionId },
        include: { missionMonthPlans: true },
    });

    if (!mission || !mission.totalContractDays) {
        await clearConflict({ type: 'CONTRACT_NOT_FULLY_PLANNED', missionId, month });
        return;
    }

    const totalPlanned = mission.missionMonthPlans.reduce((s, p) => s + p.targetDays, 0);

    if (totalPlanned < mission.totalContractDays) {
        const gap = mission.totalContractDays - totalPlanned;
        await upsertConflict({
            type: 'CONTRACT_NOT_FULLY_PLANNED',
            severity: 'P2',
            missionId,
            month,
            message: `${mission.name} — ${gap}j non planifiés sur la durée totale du contrat (${totalPlanned}/${mission.totalContractDays}j)`,
            suggestedAction: 'Créer des plans mensuels pour les mois restants',
        });
    } else {
        await clearConflict({ type: 'CONTRACT_NOT_FULLY_PLANNED', missionId, month });
    }
}

// ============================================
// P2 — MISSION_ENDING_UNPLANNED
// ============================================
async function checkMissionEndingUnplanned(missionId: string, month: string) {
    const mission = await prisma.mission.findUnique({
        where: { id: missionId },
        include: { missionMonthPlans: { include: { allocations: true } } },
    });

    if (!mission) {
        await clearConflict({ type: 'MISSION_ENDING_UNPLANNED', missionId, month });
        return;
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

    if (mission.endDate <= thirtyDaysFromNow && mission.endDate >= now) {
        // Check if all planned days are allocated
        const totalTargeted = mission.missionMonthPlans.reduce((s, p) => s + p.targetDays, 0);
        const totalAllocated = mission.missionMonthPlans.flatMap((p) => p.allocations).reduce((s, a) => s + a.allocatedDays, 0);

        if (totalAllocated < totalTargeted) {
            const gap = totalTargeted - totalAllocated;
            await upsertConflict({
                type: 'MISSION_ENDING_UNPLANNED',
                severity: 'P2',
                missionId,
                month,
                message: `${mission.name} se termine dans moins de 30j — ${gap}j non affectés`,
                suggestedAction: 'Affecter les jours restants avant la fin de mission',
            });
        } else {
            await clearConflict({ type: 'MISSION_ENDING_UNPLANNED', missionId, month });
        }
    } else {
        await clearConflict({ type: 'MISSION_ENDING_UNPLANNED', missionId, month });
    }
}

// ============================================
// P2 — NO_PLAN_FOR_ACTIVE_MONTH
// ============================================
async function checkNoplanForActiveMonth(missionId: string, month: string, monthStart: Date, monthEnd: Date) {
    const mission = await prisma.mission.findUnique({
        where: { id: missionId },
        select: { name: true, startDate: true, endDate: true, isActive: true },
    });

    if (!mission || !mission.isActive) {
        await clearConflict({ type: 'NO_PLAN_FOR_ACTIVE_MONTH', missionId, month });
        return;
    }

    // Check if mission is active this month
    const missionActive = mission.startDate <= monthEnd && mission.endDate >= monthStart;

    if (!missionActive) {
        await clearConflict({ type: 'NO_PLAN_FOR_ACTIVE_MONTH', missionId, month });
        return;
    }

    const plan = await prisma.missionMonthPlan.findUnique({
        where: { missionId_month: { missionId, month } },
    });

    if (!plan) {
        const [y, m] = month.split('-');
        const monthLabel = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric',
        });
        await upsertConflict({
            type: 'NO_PLAN_FOR_ACTIVE_MONTH',
            severity: 'P2',
            missionId,
            month,
            message: `${mission.name} est active en ${monthLabel} mais aucun plan mensuel n'existe`,
            suggestedAction: 'Créer le plan mensuel pour cette mission',
        });
    } else {
        await clearConflict({ type: 'NO_PLAN_FOR_ACTIVE_MONTH', missionId, month });
    }
}

// ============================================
// P2 — SDR_UNDERUTILIZED (< 50%)
// ============================================
async function checkSdrUnderutilized(sdrId: string, month: string) {
    const capacity = await prisma.sdrMonthCapacity.findUnique({
        where: { sdrId_month: { sdrId, month } },
    });

    if (!capacity || capacity.effectiveAvailableDays === 0) {
        await clearConflict({ type: 'SDR_UNDERUTILIZED', sdrId, month });
        return;
    }

    const allocs = await prisma.sdrDayAllocation.findMany({
        where: { sdrId, missionMonthPlan: { month } },
    });

    const totalAllocated = allocs.reduce((s, a) => s + a.allocatedDays, 0);
    const pct = totalAllocated / capacity.effectiveAvailableDays;

    if (pct < 0.5) {
        const sdr = await prisma.user.findUnique({ where: { id: sdrId }, select: { name: true } });
        const available = capacity.effectiveAvailableDays - totalAllocated;
        await upsertConflict({
            type: 'SDR_UNDERUTILIZED',
            severity: 'P2',
            sdrId,
            month,
            message: `${sdr?.name ?? sdrId} est sous-utilisé — ${totalAllocated}/${capacity.effectiveAvailableDays}j alloués (${Math.round(pct * 100)}%)`,
            suggestedAction: `${available}j disponibles — envisager d'affecter à une mission`,
        });
    } else {
        await clearConflict({ type: 'SDR_UNDERUTILIZED', sdrId, month });
    }
}

// ============================================
// Cascade: after creating an absence, recalc capacity and recompute conflicts
// ============================================
function absenceMonths(startDate: Date, endDate: Date): string[] {
    const months: string[] = [];
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate);
    while (cur <= end) {
        months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
        cur.setMonth(cur.getMonth() + 1);
    }
    return months;
}

export async function detectAbsenceCascade(params: {
    sdrId: string;
    startDate: Date;
    endDate: Date;
    impactsPlanning: boolean;
}): Promise<void> {
    const months = absenceMonths(params.startDate, params.endDate);
    const assignments = await prisma.sDRAssignment.findMany({
        where: { sdrId: params.sdrId },
        select: { missionId: true },
    });
    const missionIds = assignments.map((a) => a.missionId);

    for (const month of months) {
        if (params.impactsPlanning) {
            await recalcEffectiveCapacity(params.sdrId, month);
        }
        await recomputeConflicts({ sdrId: params.sdrId, month });
        for (const missionId of missionIds) {
            await recomputeConflicts({ missionId, month });
        }
    }
}

// ============================================
// Recalculate effectiveAvailableDays for an SDR+month
// ============================================
export async function recalcEffectiveCapacity(sdrId: string, month: string): Promise<void> {
    const capacity = await prisma.sdrMonthCapacity.findUnique({
        where: { sdrId_month: { sdrId, month } },
    });

    if (!capacity) return;

    const absenceDays = await countAbsenceDaysInMonth(sdrId, month);
    const effective = Math.max(0, capacity.baseWorkingDays - absenceDays);

    await prisma.sdrMonthCapacity.update({
        where: { sdrId_month: { sdrId, month } },
        data: { effectiveAvailableDays: effective },
    });
}
