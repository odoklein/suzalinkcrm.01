import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';

// ============================================
// GET /api/analytics/mission-date-range?missionId=xxx
// Returns first and last action dates for a mission (for auto-setting date filter)
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER', 'DEVELOPER'], request);

    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');
    if (!missionId) {
        return errorResponse('missionId requis', 400);
    }

    const campaignIds = await prisma.campaign
        .findMany({
            where: { missionId },
            select: { id: true },
        })
        .then((list) => list.map((c) => c.id));

    if (campaignIds.length === 0) {
        // Mission exists but no campaigns/actions yet: use today
        const today = new Date().toISOString().split('T')[0];
        return successResponse({ from: today, to: today });
    }

    const [first, last] = await Promise.all([
        prisma.action.findFirst({
            where: { campaignId: { in: campaignIds } },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }),
        prisma.action.findFirst({
            where: { campaignId: { in: campaignIds } },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        }),
    ]);

    const from = first ? new Date(first.createdAt) : new Date();
    const to = last ? new Date(last.createdAt) : new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    return successResponse({
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
    });
});
