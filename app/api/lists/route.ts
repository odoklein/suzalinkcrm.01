import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    paginatedResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    getPaginationParams,
} from '@/lib/api-utils';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createListSchema = z.object({
    missionId: z.string().min(1, 'Mission requise'),
    name: z.string().min(1, 'Nom requis'),
    type: z.enum(['SUZALI', 'CLIENT', 'MIXED']),
    source: z.string().optional(),
});

// ============================================
// GET /api/lists - List all lists
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);

    const missionId = searchParams.get('missionId');
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    if (missionId) where.missionId = missionId;
    if (type) where.type = type;

    const [lists, total] = await Promise.all([
        prisma.list.findMany({
            where,
            include: {
                mission: { select: { id: true, name: true, client: { select: { name: true } } } },
                _count: { select: { companies: true } },
                companies: {
                    select: {
                        status: true,
                        _count: { select: { contacts: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.list.count({ where }),
    ]);

    // Calculate completeness stats
    const listsWithStats = lists.map((list) => {
        const statusCounts = { INCOMPLETE: 0, PARTIAL: 0, ACTIONABLE: 0 };
        let totalContacts = 0;

        list.companies.forEach((company) => {
            statusCounts[company.status]++;
            totalContacts += company._count.contacts;
        });

        return {
            ...list,
            stats: {
                companyCount: list._count.companies,
                contactCount: totalContacts,
                completeness: statusCounts,
            },
        };
    });

    return paginatedResponse(listsWithStats, total, page, limit);
});

// ============================================
// POST /api/lists - Create new list
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const data = await validateRequest(request, createListSchema);

    const list = await prisma.list.create({
        data,
        include: {
            mission: { select: { id: true, name: true } },
        },
    });

    return successResponse(list, 201);
});
