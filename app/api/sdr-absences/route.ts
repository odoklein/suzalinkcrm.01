import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, requireRole, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { detectAbsenceCascade } from '@/lib/planning/conflictEngine';
import { z } from 'zod';

const createSchema = z.object({
    sdrId: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    type: z.enum(['VACATION', 'SICK', 'TRAINING', 'PUBLIC_HOLIDAY', 'PARTIAL']),
    impactsPlanning: z.boolean().default(true),
    note: z.string().optional(),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const { searchParams } = new URL(request.url);
    const sdrId = searchParams.get('sdrId');
    const month = searchParams.get('month');

    const where: Record<string, unknown> = {};
    if (sdrId) where.sdrId = sdrId;
    if (month) {
        const [y, m] = month.split('-').map(Number);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0);
        where.startDate = { lte: end };
        where.endDate = { gte: start };
    }

    const absences = await prisma.sdrAbsence.findMany({
        where,
        include: {
            sdr: { select: { id: true, name: true } },
        },
        orderBy: { startDate: 'asc' },
    });

    return successResponse(absences);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const data = await validateRequest(request, createSchema);

    const absence = await prisma.sdrAbsence.create({
        data: {
            sdrId: data.sdrId,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            type: data.type,
            impactsPlanning: data.impactsPlanning,
            note: data.note,
        },
        include: { sdr: { select: { id: true, name: true } } },
    });

    // Cascade: recalc capacity and recompute conflicts for affected months and missions
    await detectAbsenceCascade({
        sdrId: data.sdrId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        impactsPlanning: data.impactsPlanning,
    });

    return successResponse(absence, 201);
});
