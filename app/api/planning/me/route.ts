import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, requireAuth, withErrorHandler } from '@/lib/api-utils';

/**
 * GET /api/planning/me?month=2026-02
 *
 * Returns planning data for the current authenticated SDR:
 * - Schedule blocks for the given month where the SDR is assigned
 * - Mission details for those blocks
 * - SDR's capacity and absences for the month
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireAuth(request);
    const user = session.user;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return errorResponse('Paramètre month requis (format YYYY-MM)', 400);
    }

    const [y, m] = month.split('-').map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0);

    // Fetch SDR data with capacity and absences
    const sdrData = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            sdrMonthCapacities: {
                where: { month },
            },
            sdrAbsences: {
                where: {
                    startDate: { lte: monthEnd },
                    endDate: { gte: monthStart },
                },
                orderBy: { startDate: 'asc' },
            },
            sdrDayAllocations: {
                where: { missionMonthPlan: { month } },
                include: {
                    missionMonthPlan: {
                        include: { mission: { select: { id: true, name: true } } },
                    },
                },
            },
        },
    });

    if (!sdrData) {
        return errorResponse('SDR non trouvé', 404);
    }

    // Fetch schedule blocks for this SDR in the given month
    const blocks = await prisma.scheduleBlock.findMany({
        where: {
            sdrId: user.id,
            date: { gte: monthStart, lte: monthEnd },
            status: { not: 'CANCELLED' },
            OR: [
                { suggestionStatus: null },
                { suggestionStatus: 'SUGGESTED' },
                { suggestionStatus: 'CONFIRMED' },
            ],
        },
        select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            status: true,
            suggestionStatus: true,
            notes: true,
            sdrId: true,
            missionId: true,
            allocationId: true,
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

    // Group blocks by date
    const blocksByDate: Record<string, typeof blocks> = {};
    for (const block of blocks) {
        const dateKey = block.date.toISOString().slice(0, 10);
        if (!blocksByDate[dateKey]) blocksByDate[dateKey] = [];
        blocksByDate[dateKey].push(block);
    }

    // Get unique missions from blocks
    const missionIds = [...new Set(blocks.map(b => b.missionId))];
    const missions = await prisma.mission.findMany({
        where: { id: { in: missionIds } },
        select: {
            id: true,
            name: true,
            channel: true,
            channels: true,
            client: { select: { id: true, name: true } },
        },
    });

    return successResponse({
        month,
        daysInMonth: monthEnd.getDate(),
        sdr: {
            id: sdrData.id,
            name: sdrData.name,
            email: sdrData.email,
            role: sdrData.role,
            capacities: sdrData.sdrMonthCapacities,
            absences: sdrData.sdrAbsences,
            allocations: sdrData.sdrDayAllocations,
        },
        blocks,
        blocksByDate,
        missions,
    });
});
