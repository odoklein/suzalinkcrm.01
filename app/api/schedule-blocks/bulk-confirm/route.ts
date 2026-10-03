import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

const bodySchema = z.object({
    missionPlanId: z.string().min(1),
    weekStart: z.string().min(1),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const { missionPlanId, weekStart } = await validateRequest(request, bodySchema);

    const start = new Date(weekStart);
    if (isNaN(start.getTime())) {
        return errorResponse('weekStart invalide', 400);
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 4);

    const count = await prisma.scheduleBlock.updateMany({
        where: {
            missionPlanId,
            suggestionStatus: 'SUGGESTED',
            date: { gte: start, lte: end },
        },
        data: { suggestionStatus: 'CONFIRMED' },
    });

    return successResponse({ updated: count.count });
});
