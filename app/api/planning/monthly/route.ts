import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, requirePlanningAccess, withErrorHandler } from '@/lib/api-utils';

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requirePlanningAccess(request);
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return errorResponse('month requis au format YYYY-MM', 400);
    }

    const [year, mon] = month.split('-').map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 0); // last day of month

    const blocks = await prisma.scheduleBlock.findMany({
        where: {
            date: { gte: monthStart, lte: monthEnd },
            status: { not: 'CANCELLED' },
            OR: [
                { suggestionStatus: null },
                { suggestionStatus: 'SUGGESTED' },
                { suggestionStatus: 'CONFIRMED' },
            ],
        },
        include: {
            sdr: {
                select: { id: true, name: true, email: true, role: true },
            },
            mission: {
                select: {
                    id: true,
                    name: true,
                    channel: true,
                    client: { select: { id: true, name: true } },
                },
            },
            createdBy: {
                select: { id: true, name: true },
            },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const team = await prisma.user.findMany({
        where: {
            role: { in: ['SDR', 'BUSINESS_DEVELOPER'] },
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    const missions = await prisma.mission.findMany({
        where: { isActive: true },
        select: {
            id: true,
            name: true,
            channel: true,
            client: { select: { id: true, name: true } },
            sdrAssignments: {
                select: { sdr: { select: { id: true, name: true } } },
            },
        },
        orderBy: { name: 'asc' },
    });

    // Group blocks by date string (YYYY-MM-DD)
    const blocksByDate: Record<string, typeof blocks> = {};
    for (const block of blocks) {
        const dateKey = new Date(block.date).toISOString().slice(0, 10);
        if (!blocksByDate[dateKey]) blocksByDate[dateKey] = [];
        blocksByDate[dateKey].push(block);
    }

    return successResponse({
        month,
        daysInMonth: monthEnd.getDate(),
        blocks,
        blocksByDate,
        team,
        missions,
    });
});
