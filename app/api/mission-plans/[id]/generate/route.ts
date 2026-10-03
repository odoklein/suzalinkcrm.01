import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
} from '@/lib/api-utils';
import { generateSuggestedBlocks } from '@/lib/planning/generateSuggestions';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const session = await requireRole(['MANAGER'], request);
    const { id: planId } = await params;

    const plan = await prisma.missionPlan.findUnique({
        where: { id: planId },
        select: { id: true },
    });

    if (!plan) {
        throw new NotFoundError('Plan introuvable');
    }

    const result = await generateSuggestedBlocks(
        prisma,
        planId,
        session.user.id
    );

    return successResponse(result);
});
