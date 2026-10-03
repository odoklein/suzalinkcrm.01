import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
    getPaginationParams,
    paginatedResponse,
} from '@/lib/api-utils';
import { Prisma } from '@prisma/client';

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['MANAGER', 'DEVELOPER'], request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const sdrIds = searchParams.getAll('sdrIds[]');
    const missionIds = searchParams.getAll('missionIds[]');
    const clientIds = searchParams.getAll('clientIds[]');
    const listIds = searchParams.getAll('listIds[]');
    const results = searchParams.getAll('results[]');

    const dateTo = to ? new Date(to) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    const dateFrom = from ? new Date(from) : new Date(dateTo);
    if (!from) {
        dateFrom.setDate(dateFrom.getDate() - 30);
    }
    dateFrom.setHours(0, 0, 0, 0);

    const where: Prisma.ActionWhereInput = {
        channel: 'CALL',
        createdAt: {
            gte: dateFrom,
            lte: dateTo,
        },
    };

    if (sdrIds.length > 0) {
        where.sdrId = { in: sdrIds };
    }

    if (missionIds.length > 0 || clientIds.length > 0) {
        where.campaign = {
            mission: {
                ...(missionIds.length > 0 && { id: { in: missionIds } }),
                ...(clientIds.length > 0 && { clientId: { in: clientIds } }),
            }
        };
    }

    if (listIds.length > 0) {
        where.OR = [
            { company: { listId: { in: listIds } } },
            { contact: { company: { listId: { in: listIds } } } },
        ];
    }

    if (results.length > 0) {
        where.result = { in: { in: results } as any }; // Zod/Prisma type dance
    }

    const [actions, total] = await Promise.all([
        prisma.action.findMany({
            where,
            include: {
                sdr: { select: { id: true, name: true } },
                contact: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        company: { select: { name: true } }
                    }
                },
                campaign: {
                    select: {
                        mission: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.action.count({ where }),
    ]);

    const items = actions.map(a => ({
        id: a.id,
        createdAt: a.createdAt,
        sdrName: a.sdr.name,
        contactName: a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : 'N/A',
        companyName: a.contact?.company?.name || 'N/A',
        missionName: a.campaign?.mission?.name || 'N/A',
        result: a.result,
        duration: a.duration,
        note: a.note,
    }));

    return paginatedResponse(items, total, page, limit);
});
