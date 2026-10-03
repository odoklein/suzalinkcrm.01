import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, requirePlanningAccess, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { recomputeConflicts } from '@/lib/planning/conflictEngine';
import { buildAbsenceDayKeySet, toDateKey } from '@/lib/planning/absences';
import { z } from 'zod';

const createSchema = z.object({
    sdrId: z.string().min(1),
    missionMonthPlanId: z.string().min(1),
    allocatedDays: z.number().int().min(0),
    autoCreateBlocks: z.boolean().optional(),
    missionId: z.string().optional(),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requirePlanningAccess(request);
    const { searchParams } = new URL(request.url);
    const sdrId = searchParams.get('sdrId');
    const missionMonthPlanId = searchParams.get('missionMonthPlanId');
    const month = searchParams.get('month');

    const where: Record<string, unknown> = {};
    if (sdrId) where.sdrId = sdrId;
    if (missionMonthPlanId) where.missionMonthPlanId = missionMonthPlanId;
    if (month) where.missionMonthPlan = { month };

    const allocations = await prisma.sdrDayAllocation.findMany({
        where,
        include: {
            sdr: { select: { id: true, name: true, email: true } },
            missionMonthPlan: {
                include: { mission: { select: { id: true, name: true } } },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    return successResponse(allocations);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requirePlanningAccess(request);
    const data = await validateRequest(request, createSchema);

    const plan = await prisma.missionMonthPlan.findUnique({
        where: { id: data.missionMonthPlanId },
    });
    if (!plan) return errorResponse('Plan mensuel introuvable', 404);

    await prisma.sDRAssignment.upsert({
        where: {
            missionId_sdrId: {
                sdrId: data.sdrId,
                missionId: plan.missionId,
            },
        },
        create: {
            sdrId: data.sdrId,
            missionId: plan.missionId,
        },
        update: {},
    });

    const existing = await prisma.sdrDayAllocation.findUnique({
        where: { sdrId_missionMonthPlanId: { sdrId: data.sdrId, missionMonthPlanId: data.missionMonthPlanId } },
    });
    if (existing) return errorResponse('Une allocation existe déjà pour ce SDR sur ce plan', 409);

    const allocation = await prisma.sdrDayAllocation.create({
        data: {
            sdrId: data.sdrId,
            missionMonthPlanId: data.missionMonthPlanId,
            allocatedDays: data.allocatedDays,
        },
        include: {
            sdr: { select: { id: true, name: true } },
            missionMonthPlan: { include: { mission: { select: { id: true, name: true } } } },
        },
    });

    let blocksCreated = 0;

    let blocksSkippedAbsent = 0;

    if (data.autoCreateBlocks && plan.workingDays && data.missionId) {
        const dayNums = plan.workingDays.split(',').map(Number).filter(Boolean);
        if (dayNums.length > 0) {
            const [yr, mo] = plan.month.split('-').map(Number);
            const daysInMonth = new Date(yr, mo, 0).getDate();
            const startTime = plan.defaultStartTime || '09:00';
            const endTime = plan.defaultEndTime || '17:00';
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const monthStart = new Date(yr, mo - 1, 1);
            const monthEnd = new Date(yr, mo - 1, daysInMonth);

            const existingBlocks = await prisma.scheduleBlock.findMany({
                where: {
                    sdrId: data.sdrId,
                    missionId: data.missionId,
                    date: { gte: monthStart, lte: monthEnd },
                    status: { not: 'CANCELLED' },
                },
                select: { date: true },
            });
            const existingDates = new Set(existingBlocks.map(b => b.date.toISOString().slice(0, 10)));

            // Days where this SDR is absent — skip them when placing blocks.
            const absentKeys = await buildAbsenceDayKeySet({
                sdrIds: [data.sdrId],
                from: monthStart,
                to: monthEnd,
            });

            const blockData: Array<{
                sdrId: string;
                missionId: string;
                date: Date;
                startTime: string;
                endTime: string;
                status: 'SCHEDULED';
                suggestionStatus: 'CONFIRMED';
                allocationId: string;
                createdById: string;
            }> = [];

            let placed = 0;
            for (let d = 1; d <= daysInMonth && placed < data.allocatedDays; d++) {
                const date = new Date(yr, mo - 1, d);
                if (date < today) continue;
                const dow = date.getDay() === 0 ? 7 : date.getDay(); // 1=Mon..7=Sun
                if (!dayNums.includes(dow)) continue;
                const dateStr = date.toISOString().slice(0, 10);
                if (existingDates.has(dateStr)) continue;
                if (absentKeys.has(`${data.sdrId}:${toDateKey(date)}`)) {
                    blocksSkippedAbsent++;
                    continue;
                }

                blockData.push({
                    sdrId: data.sdrId,
                    missionId: data.missionId,
                    date,
                    startTime,
                    endTime,
                    status: 'SCHEDULED',
                    suggestionStatus: 'CONFIRMED',
                    allocationId: allocation.id,
                    createdById: session.user.id,
                });
                placed++;
            }

            if (blockData.length > 0) {
                const result = await prisma.scheduleBlock.createMany({ data: blockData });
                blocksCreated = result.count;
                await prisma.sdrDayAllocation.update({
                    where: { id: allocation.id },
                    data: { scheduledDays: blocksCreated },
                });
            }
        }
    }

    await recomputeConflicts({ sdrId: data.sdrId, missionId: plan.missionId, month: plan.month });

    return successResponse({ ...allocation, blocksCreated, blocksSkippedAbsent }, 201);
});
