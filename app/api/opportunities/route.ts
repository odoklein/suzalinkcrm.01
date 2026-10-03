import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    paginatedResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    getPaginationParams,
} from '@/lib/api-utils';
import { createClientPortalNotification } from '@/lib/notifications';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createOpportunitySchema = z.object({
    contactId: z.string().min(1, 'Contact requis'),
    companyId: z.string().min(1, 'Entreprise requise'),
    needSummary: z.string().min(10, 'Description du besoin requise (min 10 caractères)'),
    urgency: z.enum(['SHORT', 'MEDIUM', 'LONG']),
    estimatedMin: z.number().positive().optional(),
    estimatedMax: z.number().positive().optional(),
    notes: z.string().optional(),
});

const updateOpportunitySchema = z.object({
    needSummary: z.string().min(10).optional(),
    urgency: z.enum(['SHORT', 'MEDIUM', 'LONG']).optional(),
    estimatedMin: z.number().positive().optional(),
    estimatedMax: z.number().positive().optional(),
    notes: z.string().optional(),
    handedOff: z.boolean().optional(),
});

// ============================================
// GET /api/opportunities - List opportunities
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['MANAGER', 'CLIENT', 'SDR', 'BUSINESS_DEVELOPER'], request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);

    const where: Record<string, unknown> = {};

    // Role-based filtering
    if (session.user.role === 'CLIENT') {
        where.contact = {
            company: {
                list: {
                    mission: {
                        client: {
                            users: { some: { id: session.user.id } },
                        },
                    },
                },
            },
        };
    } else if (session.user.role === 'BUSINESS_DEVELOPER') {
        const assignments = await prisma.sDRAssignment.findMany({
            where: { sdrId: session.user.id },
            select: { missionId: true },
        });
        const missionIds = assignments.map((a) => a.missionId);
        if (missionIds.length === 0) {
            return paginatedResponse([], 0, 1, limit);
        }
        where.contact = {
            company: { list: { missionId: { in: missionIds } } },
        };
    }

    // Filters
    const urgency = searchParams.get('urgency');
    const handedOff = searchParams.get('handedOff');
    const missionId = searchParams.get('missionId');

    if (urgency) where.urgency = urgency;
    if (handedOff !== null) where.handedOff = handedOff === 'true';
    if (missionId) {
        where.contact = where.contact
            ? {
                ...(where.contact as object),
                company: {
                    list: { missionId },
                },
            }
            : {
                company: { list: { missionId } },
            };
    }

    const [opportunities, total] = await Promise.all([
        prisma.opportunity.findMany({
            where,
            include: {
                contact: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        title: true,
                        email: true,
                        phone: true,
                    },
                },
                company: {
                    select: {
                        id: true,
                        name: true,
                        industry: true,
                        country: true,
                    },
                },
            },
            orderBy: [
                { handedOff: 'asc' }, // Not handed off first
                { urgency: 'asc' }, // SHORT > MEDIUM > LONG
                { createdAt: 'desc' },
            ],
            skip,
            take: limit,
        }),
        prisma.opportunity.count({ where }),
    ]);

    return paginatedResponse(opportunities, total, page, limit);
});

// ============================================
// POST /api/opportunities - Create opportunity
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER', 'SDR'], request);
    const data = await validateRequest(request, createOpportunitySchema);

    // Verify contact and company exist and are linked
    const contact = await prisma.contact.findUnique({
        where: { id: data.contactId },
        include: {
            company: {
                include: {
                    list: {
                        include: {
                            mission: { select: { clientId: true } },
                        },
                    },
                },
            },
        },
    });

    if (!contact) {
        return errorResponse('Contact introuvable', 404);
    }

    if (contact.companyId !== data.companyId) {
        return errorResponse('Contact et entreprise non liés', 400);
    }

    // Check for duplicate
    const existing = await prisma.opportunity.findFirst({
        where: { contactId: data.contactId },
    });

    if (existing) {
        return errorResponse('Une opportunité existe déjà pour ce contact', 400);
    }

    const opportunity = await prisma.opportunity.create({
        data,
        include: {
            contact: true,
            company: true,
        },
    });

    const clientId = contact.company.list.mission.clientId;
    if (clientId) {
        await createClientPortalNotification(clientId, {
            title: 'Nouvelle opportunité',
            message: 'Un nouveau contact qualifié est disponible sur votre tableau de bord.',
            type: 'info',
            link: '/client/portal',
        });
    }

    return successResponse(opportunity, 201);
});
