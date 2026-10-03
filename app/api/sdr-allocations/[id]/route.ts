import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, requirePlanningAccess, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { recomputeConflicts } from '@/lib/planning/conflictEngine';
import { z } from 'zod';

interface RouteParams {
    params: Promise<{ id: string }>;
}

const updateSchema = z.object({
    allocatedDays: z.number().int().min(0).optional(),
    status: z.enum(['UNCOMMITTED', 'PARTIAL', 'SCHEDULED', 'CONFIRMED']).optional(),
});

export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requirePlanningAccess(request);
    const { id } = await params;
    const alloc = await prisma.sdrDayAllocation.findUnique({
        where: { id },
        include: {
            sdr: { select: { id: true, name: true, email: true } },
            missionMonthPlan: {
                include: { mission: { select: { id: true, name: true } } },
            },
        },
    });
    if (!alloc) return errorResponse('Allocation introuvable', 404);
    return successResponse(alloc);
});

export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requirePlanningAccess(request);
    const { id } = await params;
    const data = await validateRequest(request, updateSchema);

    const alloc = await prisma.sdrDayAllocation.findUnique({
        where: { id },
        include: { missionMonthPlan: true },
    });
    if (!alloc) return errorResponse('Allocation introuvable', 404);

    const updated = await prisma.sdrDayAllocation.update({
        where: { id },
        data,
        include: {
            sdr: { select: { id: true, name: true } },
            missionMonthPlan: { include: { mission: { select: { id: true, name: true } } } },
        },
    });

    await recomputeConflicts({
        sdrId: alloc.sdrId,
        missionId: alloc.missionMonthPlan.missionId,
        month: alloc.missionMonthPlan.month,
    });

    return successResponse(updated);
});

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requirePlanningAccess(request);
    const { id } = await params;

    const alloc = await prisma.sdrDayAllocation.findUnique({
        where: { id },
        include: { missionMonthPlan: true },
    });
    if (!alloc) return errorResponse('Allocation introuvable', 404);

    await prisma.$transaction([
        prisma.scheduleBlock.deleteMany({ where: { allocationId: id } }),
        prisma.sdrDayAllocation.delete({ where: { id } }),
    ]);

    await recomputeConflicts({
        sdrId: alloc.sdrId,
        missionId: alloc.missionMonthPlan.missionId,
        month: alloc.missionMonthPlan.month,
    });

    return successResponse({ deleted: true });
});
