import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, requirePlanningAccess, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { recomputeConflicts } from '@/lib/planning/conflictEngine';
import { z } from 'zod';

interface RouteParams {
    params: Promise<{ id: string }>;
}

const updateSchema = z.object({
    targetDays: z.number().int().min(0).optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'LOCKED']).optional(),
    workingDays: z.string().nullable().optional(),
    defaultStartTime: z.string().nullable().optional(),
    defaultEndTime: z.string().nullable().optional(),
});

export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requirePlanningAccess(request);
    const { id } = await params;

    const plan = await prisma.missionMonthPlan.findUnique({
        where: { id },
        include: {
            mission: { select: { id: true, name: true, channel: true } },
            allocations: {
                include: {
                    sdr: { select: { id: true, name: true, email: true } },
                },
            },
        },
    });

    if (!plan) return errorResponse('Plan introuvable', 404);
    return successResponse(plan);
});

export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requirePlanningAccess(request);
    const { id } = await params;
    const data = await validateRequest(request, updateSchema);

    const existing = await prisma.missionMonthPlan.findUnique({ where: { id } });
    if (!existing) return errorResponse('Plan introuvable', 404);

    const plan = await prisma.missionMonthPlan.update({
        where: { id },
        data: {
            ...(data.targetDays !== undefined && { targetDays: data.targetDays }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.workingDays !== undefined && { workingDays: data.workingDays }),
            ...(data.defaultStartTime !== undefined && { defaultStartTime: data.defaultStartTime }),
            ...(data.defaultEndTime !== undefined && { defaultEndTime: data.defaultEndTime }),
        },
        include: {
            allocations: { include: { sdr: { select: { id: true, name: true } } } },
        },
    });

    await recomputeConflicts({ missionId: existing.missionId, month: existing.month });

    return successResponse(plan);
});

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requirePlanningAccess(request);
    const { id } = await params;

    const existing = await prisma.missionMonthPlan.findUnique({ where: { id } });
    if (!existing) return errorResponse('Plan introuvable', 404);

    const allocations = await prisma.sdrDayAllocation.findMany({
        where: { missionMonthPlanId: id },
        select: { id: true },
    });
    const allocIds = allocations.map((a) => a.id);

    await prisma.$transaction([
        ...(allocIds.length > 0
            ? [prisma.scheduleBlock.deleteMany({ where: { allocationId: { in: allocIds } } })]
            : []),
        prisma.sdrDayAllocation.deleteMany({ where: { missionMonthPlanId: id } }),
        prisma.missionMonthPlan.delete({ where: { id } }),
    ]);

    await recomputeConflicts({ missionId: existing.missionId, month: existing.month });

    return successResponse({ message: 'Plan supprimé' });
});
