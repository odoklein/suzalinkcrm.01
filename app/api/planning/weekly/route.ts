import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, requirePlanningAccess, withErrorHandler } from '@/lib/api-utils';

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requirePlanningAccess(request);
    const { searchParams } = new URL(request.url);
    const weekStartParam = searchParams.get('weekStart');

    if (!weekStartParam) {
        return errorResponse('weekStart requis (YYYY-MM-DD, lundi)', 400);
    }

    const weekStart = new Date(weekStartParam);
    if (isNaN(weekStart.getTime())) {
        return errorResponse('weekStart invalide', 400);
    }
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 4);

    const blocks = await prisma.scheduleBlock.findMany({
        where: {
            date: { gte: weekStart, lte: weekEnd },
            status: { not: 'CANCELLED' },
            OR: [
                { suggestionStatus: null },
                { suggestionStatus: 'SUGGESTED' },
                { suggestionStatus: 'CONFIRMED' },
            ],
        },
        include: {
            sdr: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                },
            },
            mission: {
                select: {
                    id: true,
                    name: true,
                    channel: true,
                    startDate: true,
                    endDate: true,
                    client: { select: { id: true, name: true } },
                },
            },
            missionPlan: {
                select: { id: true, status: true },
            },
            createdBy: {
                select: { id: true, name: true },
            },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    // Only return blocks whose date is within the mission's startDate/endDate
    const missionStart = (m: { startDate: Date } | null) => (m?.startDate ? new Date(m.startDate).getTime() : -Infinity);
    const missionEnd = (m: { endDate: Date } | null) => (m?.endDate ? new Date(m.endDate).getTime() : Infinity);
    const blockDateMs = (b: { date: Date }) => new Date(b.date).setHours(0, 0, 0, 0);
    const filteredBlocks = blocks.filter((b) => {
        const m = b.mission as { startDate?: Date; endDate?: Date } | null;
        if (!m) return true;
        const start = missionStart(m);
        const end = missionEnd(m);
        const d = blockDateMs(b);
        return d >= start && d <= end;
    });

    const missionPlans = await prisma.missionPlan.findMany({
        where: {
            mission: { isActive: true },
            status: { in: ['DRAFT', 'ACTIVE'] },
        },
        include: {
            mission: {
                select: {
                    id: true,
                    name: true,
                    channel: true,
                },
            },
            assignedSdrs: {
                include: {
                    sdr: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: { updatedAt: 'desc' },
    });

    const team = await prisma.user.findMany({
        where: {
            role: { in: ['SDR', 'BUSINESS_DEVELOPER'] },
            assignedMissions: { some: {} },
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    return successResponse({
        blocks: filteredBlocks,
        missionPlans,
        team,
    });
});
