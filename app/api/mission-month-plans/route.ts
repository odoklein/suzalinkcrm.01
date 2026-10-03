import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, requirePlanningAccess, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { recomputeConflicts } from '@/lib/planning/conflictEngine';
import { z } from 'zod';

const createSchema = z.object({
    missionId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
    targetDays: z.number().int().min(0),
    status: z.enum(['DRAFT', 'ACTIVE', 'LOCKED']).optional(),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requirePlanningAccess(request);
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');
    const month = searchParams.get('month');

    const where: Record<string, unknown> = {};
    if (missionId) where.missionId = missionId;
    if (month) where.month = month;

    const plans = await prisma.missionMonthPlan.findMany({
        where,
        include: {
            allocations: {
                include: {
                    sdr: { select: { id: true, name: true, email: true } },
                },
            },
        },
        orderBy: { month: 'asc' },
    });

    return successResponse(plans);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requirePlanningAccess(request);
    const data = await validateRequest(request, createSchema);

    // Check mission exists
    const mission = await prisma.mission.findUnique({ where: { id: data.missionId } });
    if (!mission) return errorResponse('Mission introuvable', 404);

    // Prevent duplicate month plan
    const existing = await prisma.missionMonthPlan.findUnique({
        where: { missionId_month: { missionId: data.missionId, month: data.month } },
    });
    if (existing) return errorResponse('Un plan existe déjà pour ce mois', 409);

    const plan = await prisma.missionMonthPlan.create({
        data: {
            missionId: data.missionId,
            month: data.month,
            targetDays: data.targetDays,
            status: data.status ?? 'DRAFT',
        },
        include: {
            allocations: { include: { sdr: { select: { id: true, name: true } } } },
        },
    });

    await recomputeConflicts({ missionId: data.missionId, month: data.month });

    return successResponse(plan, 201);
});
