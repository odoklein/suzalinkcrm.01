import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requirePlanningAccess,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { 
    createScheduleUpdateNotification, 
    createScheduleCancelNotification 
} from '@/lib/notifications';
import { recomputeConflicts } from '@/lib/planning/conflictEngine';
import { z } from 'zod';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// ============================================
// GET /api/planning/[id] - Get schedule block
// ============================================

export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requirePlanningAccess(request);
    const { id } = await params;

    const block = await prisma.scheduleBlock.findUnique({
        where: { id },
        include: {
            sdr: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            mission: {
                select: {
                    id: true,
                    name: true,
                    channel: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            missionPlan: { select: { id: true, status: true } },
            createdBy: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    if (!block) {
        return errorResponse('Bloc non trouvé', 404);
    }

    return successResponse(block);
});

// ============================================
// PUT /api/planning/[id] - Update schedule block
// ============================================

const updateBlockSchema = z.object({
    missionId: z.string().optional(),
    date: z.string().optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    notes: z.string().optional().nullable(),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    suggestionStatus: z.enum(['SUGGESTED', 'CONFIRMED', 'REJECTED']).optional(),
});

export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requirePlanningAccess(request);
    const { id } = await params;
    const data = await validateRequest(request, updateBlockSchema);

    // Get existing block
    const existingBlock = await prisma.scheduleBlock.findUnique({
        where: { id },
    });

    if (!existingBlock) {
        return errorResponse('Bloc non trouvé', 404);
    }

    const newStartTime = data.startTime || existingBlock.startTime;
    const newEndTime = data.endTime || existingBlock.endTime;
    const newDate = data.date ? new Date(data.date) : existingBlock.date;

    // Validate time range
    if (newStartTime >= newEndTime) {
        return errorResponse('L\'heure de début doit être avant l\'heure de fin', 400);
    }

    // Overlapping blocks are allowed: updates can create conflicts and those conflicts
    // are handled by planning conflict reporting rather than by blocking the change.

    const block = await prisma.scheduleBlock.update({
        where: { id },
        data: {
            ...(data.missionId !== undefined && { missionId: data.missionId }),
            ...(data.date && { date: newDate }),
            ...(data.startTime !== undefined && { startTime: data.startTime }),
            ...(data.endTime !== undefined && { endTime: data.endTime }),
            ...(data.notes !== undefined && { notes: data.notes }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.suggestionStatus !== undefined && { suggestionStatus: data.suggestionStatus }),
        },
        include: {
            sdr: {
                select: {
                    id: true,
                    name: true,
                    role: true,
                },
            },
            mission: {
                select: {
                    id: true,
                    name: true,
                    client: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
            missionPlan: { select: { id: true, status: true } },
            createdBy: {
                select: {
                    name: true,
                },
            },
        },
    });

    // Send notification about the update (only if significant changes)
    if (data.date || data.startTime || data.endTime || data.missionId) {
        await createScheduleUpdateNotification({
            userId: block.sdr.id,
            userRole: block.sdr.role,
            missionName: block.mission.name,
            clientName: block.mission.client.name,
            date: block.date.toISOString(),
            startTime: block.startTime,
            endTime: block.endTime,
            managerName: block.createdBy.name,
        });
    }

    return successResponse(block);
});

// ============================================
// DELETE /api/planning/[id] - Delete schedule block
// ============================================

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requirePlanningAccess(request);
    const { id } = await params;

    // Fetch block with related data before deleting
    const block = await prisma.scheduleBlock.findUnique({
        where: { id },
        include: {
            sdr: {
                select: {
                    id: true,
                    name: true,
                    role: true,
                },
            },
            mission: {
                select: {
                    name: true,
                    client: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        },
    });
    // allocationId is not in include, fetch it separately
    const blockFull = await prisma.scheduleBlock.findUnique({ where: { id }, select: { allocationId: true, sdrId: true } });

    if (!block) {
        return errorResponse('Bloc non trouvé', 404);
    }

    // Send notification before deleting
    await createScheduleCancelNotification({
        userId: block.sdr.id,
        userRole: block.sdr.role,
        missionName: block.mission.name,
        clientName: block.mission.client.name,
        date: block.date.toISOString(),
        startTime: block.startTime,
        endTime: block.endTime,
    });

    // Decrement scheduledDays on allocation before deleting
    if (blockFull?.allocationId) {
        await prisma.sdrDayAllocation.update({
            where: { id: blockFull.allocationId },
            data: { scheduledDays: { decrement: 1 } },
        }).catch(() => null);
    }

    await prisma.scheduleBlock.delete({
        where: { id },
    });

    // Recompute conflicts if block was linked to an allocation
    if (blockFull?.allocationId) {
        const alloc = await prisma.sdrDayAllocation.findUnique({
            where: { id: blockFull.allocationId },
            include: { missionMonthPlan: true },
        }).catch(() => null);
        if (alloc) {
            await recomputeConflicts({
                sdrId: blockFull.sdrId,
                missionId: alloc.missionMonthPlan.missionId,
                month: alloc.missionMonthPlan.month,
            });
        }
    }

    return successResponse({ message: 'Bloc supprimé' });
});
