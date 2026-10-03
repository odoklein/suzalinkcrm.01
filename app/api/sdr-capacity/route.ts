import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, requireRole, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { recomputeConflicts } from '@/lib/planning/conflictEngine';
import { z } from 'zod';

const upsertSchema = z.object({
    sdrId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
    baseWorkingDays: z.number().int().min(0).max(31),
    effectiveAvailableDays: z.number().int().min(0).max(31).optional(),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const { searchParams } = new URL(request.url);
    const sdrId = searchParams.get('sdrId');
    const month = searchParams.get('month');

    const where: Record<string, unknown> = {};
    if (sdrId) where.sdrId = sdrId;
    if (month) where.month = month;

    const capacities = await prisma.sdrMonthCapacity.findMany({
        where,
        include: {
            sdr: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ month: 'asc' }, { sdrId: 'asc' }],
    });

    return successResponse(capacities);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const data = await validateRequest(request, upsertSchema);

    const effective = data.effectiveAvailableDays ?? data.baseWorkingDays;

    const capacity = await prisma.sdrMonthCapacity.upsert({
        where: { sdrId_month: { sdrId: data.sdrId, month: data.month } },
        create: {
            sdrId: data.sdrId,
            month: data.month,
            baseWorkingDays: data.baseWorkingDays,
            effectiveAvailableDays: effective,
        },
        update: {
            baseWorkingDays: data.baseWorkingDays,
            effectiveAvailableDays: effective,
        },
        include: {
            sdr: { select: { id: true, name: true } },
        },
    });

    await recomputeConflicts({ sdrId: data.sdrId, month: data.month });

    return successResponse(capacity, 201);
});
