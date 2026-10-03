import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, requirePlanningAccess, withErrorHandler } from '@/lib/api-utils';

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requirePlanningAccess(request);
    const { searchParams } = new URL(request.url);

    const month = searchParams.get('month');
    const sdrId = searchParams.get('sdrId');
    const missionId = searchParams.get('missionId');
    const severity = searchParams.get('severity');
    const resolved = searchParams.get('resolved');

    const where: Record<string, unknown> = {};
    if (month) where.month = month;
    if (sdrId) where.sdrId = sdrId;
    if (missionId) where.missionId = missionId;
    if (severity) where.severity = severity;

    // By default only show unresolved
    if (resolved === 'true') {
        where.resolvedAt = { not: null };
    } else {
        where.resolvedAt = null;
    }

    const conflicts = await prisma.planningConflict.findMany({
        where,
        orderBy: [
            { severity: 'asc' }, // P0 first
            { createdAt: 'asc' },
        ],
    });

    // Summary counts by severity
    const summary = {
        P0: conflicts.filter((c) => c.severity === 'P0').length,
        P1: conflicts.filter((c) => c.severity === 'P1').length,
        P2: conflicts.filter((c) => c.severity === 'P2').length,
        total: conflicts.length,
    };

    return successResponse({ conflicts, summary });
});

// PATCH to mark a conflict as resolved
export const PATCH = withErrorHandler(async (request: NextRequest) => {
    await requirePlanningAccess(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        const body = await request.json();
        // Bulk resolve by type+sdrId+missionId+month
        if (body.type && body.month) {
            await prisma.planningConflict.updateMany({
                where: {
                    type: body.type,
                    month: body.month,
                    sdrId: body.sdrId ?? undefined,
                    missionId: body.missionId ?? undefined,
                    resolvedAt: null,
                },
                data: { resolvedAt: new Date() },
            });
            return successResponse({ resolved: true });
        }
    }

    await prisma.planningConflict.update({
        where: { id: id! },
        data: { resolvedAt: new Date() },
    });

    return successResponse({ resolved: true });
});
