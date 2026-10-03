import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, requireRole, withErrorHandler } from '@/lib/api-utils';
import { recomputeConflicts, recalcEffectiveCapacity } from '@/lib/planning/conflictEngine';

interface RouteParams {
    params: Promise<{ id: string }>;
}

function absenceMonths(startDate: Date, endDate: Date): string[] {
    const months: string[] = [];
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cur <= endDate) {
        months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
        cur.setMonth(cur.getMonth() + 1);
    }
    return months;
}

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;

    const absence = await prisma.sdrAbsence.findUnique({ where: { id } });
    if (!absence) return errorResponse('Absence introuvable', 404);

    await prisma.sdrAbsence.delete({ where: { id } });

    const months = absenceMonths(absence.startDate, absence.endDate);
    for (const month of months) {
        if (absence.impactsPlanning) {
            await recalcEffectiveCapacity(absence.sdrId, month);
        }
        await recomputeConflicts({ sdrId: absence.sdrId, month });
    }

    return successResponse({ deleted: true });
});
