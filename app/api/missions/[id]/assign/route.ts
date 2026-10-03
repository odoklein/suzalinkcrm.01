import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    requirePermission,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { recomputeConflicts } from '@/lib/planning/conflictEngine';
import { z } from 'zod';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// ============================================
// PATCH /api/missions/[id]/assign - Assign SDR to mission
// ============================================

const assignSchema = z.object({
    sdrId: z.string().min(1, 'SDR requis'),
});

export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const session = await requireRole(['MANAGER', 'BUSINESS_DEVELOPER', 'SDR'], request);
    if (session.user.role === 'SDR') {
        await requirePermission('pages.planning', request);
    }
    const { id } = await params;
    const data = await validateRequest(request, assignSchema);

    const mission = await prisma.mission.findUnique({
        where: { id },
    });

    if (!mission) {
        return errorResponse('Mission non trouvée', 404);
    }

    const sdr = await prisma.user.findUnique({
        where: { id: data.sdrId },
    });

    if (!sdr) {
        return errorResponse('SDR non trouvé', 404);
    }

    const assignment = await prisma.sDRAssignment.upsert({
        where: {
            missionId_sdrId: {
                sdrId: data.sdrId,
                missionId: id,
            },
        },
        create: {
            missionId: id,
            sdrId: data.sdrId,
        },
        update: {},
        include: {
            sdr: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    return successResponse(assignment);
});

// ============================================
// DELETE /api/missions/[id]/assign - Remove SDR from mission
// ============================================

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sdrId = searchParams.get('sdrId');

    if (!sdrId) {
        return errorResponse('SDR ID requis', 400);
    }

    const assignment = await prisma.sDRAssignment.findFirst({
        where: {
            missionId: id,
            sdrId,
        },
    });

    if (!assignment) {
        return errorResponse('Assignation non trouvée', 404);
    }

    const plans = await prisma.missionMonthPlan.findMany({
        where: { missionId: id },
        select: { id: true, month: true },
    });
    const planIds = plans.map((p) => p.id);

    const allocations = await prisma.sdrDayAllocation.findMany({
        where: { sdrId, missionMonthPlanId: { in: planIds } },
        select: { id: true },
    });
    const allocIds = allocations.map((a) => a.id);

    await prisma.$transaction([
        ...(allocIds.length > 0
            ? [prisma.scheduleBlock.deleteMany({ where: { allocationId: { in: allocIds } } })]
            : []),
        ...(planIds.length > 0
            ? [
                prisma.sdrDayAllocation.deleteMany({
                    where: { sdrId, missionMonthPlanId: { in: planIds } },
                }),
            ]
            : []),
        prisma.sDRAssignment.delete({
            where: { id: assignment.id },
        }),
        // Clear team lead if the removed user was the team lead
        prisma.mission.updateMany({
            where: { id, teamLeadSdrId: sdrId },
            data: { teamLeadSdrId: null },
        }),
    ]);

    for (const plan of plans) {
        await recomputeConflicts({
            sdrId,
            missionId: id,
            month: plan.month,
        });
    }

    return successResponse({ message: 'SDR retiré de la mission' });
});
