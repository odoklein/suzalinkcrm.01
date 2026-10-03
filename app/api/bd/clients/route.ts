import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    getPaginationParams,
    paginatedResponse,
} from '@/lib/api-utils';
import { z } from 'zod';

// ============================================
// GET /api/bd/clients - Get BD's portfolio clients
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['BUSINESS_DEVELOPER'], request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    // Get clients in BD's portfolio
    const portfolioClients = await prisma.businessDeveloperClient.findMany({
        where: {
            bdUserId: session.user.id,
            isActive: true,
        },
        select: {
            clientId: true,
        },
    });

    const clientIds = portfolioClients.map(pc => pc.clientId);

    if (clientIds.length === 0) {
        return paginatedResponse([], 0, page, limit);
    }

    // Build where clause
    const where: Record<string, unknown> = {
        id: { in: clientIds },
    };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { industry: { contains: search, mode: 'insensitive' } },
        ];
    }

    // Filter by onboarding status if provided
    if (status) {
        where.onboarding = {
            status: status,
        };
    }

    const [clients, total] = await Promise.all([
        prisma.client.findMany({
            where,
            include: {
                onboarding: {
                    select: {
                        status: true,
                        targetLaunchDate: true,
                        completedAt: true,
                        onboardingData: true,
                    },
                },
                _count: {
                    select: {
                        missions: true,
                        users: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.client.count({ where }),
    ]);

    const clientsWithReadiness = clients.map((c) => {
        const od = c.onboarding?.onboardingData as { icp?: string } | null;
        const personaSet = !!(od?.icp && String(od.icp).trim());
        return {
            ...c,
            readiness: {
                calendarConnected: !!(c as { bookingUrl?: string }).bookingUrl?.trim(),
                personaSet,
                missionCreated: (c._count?.missions ?? 0) > 0,
            },
        };
    });

    return paginatedResponse(clientsWithReadiness, total, page, limit);
});

// ============================================
// POST /api/bd/clients - Create new client (with onboarding)
// ============================================

const createClientSchema = z.object({
    name: z.string().min(1, 'Nom requis'),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    onboardingData: z.record(z.string(), z.unknown()).optional(),
    targetLaunchDate: z.string().optional().nullable(),
    scripts: z.record(z.string(), z.unknown()).optional(),
    notes: z.string().optional().nullable(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['BUSINESS_DEVELOPER'], request);
    const data = await validateRequest(request, createClientSchema);

    // Create client with onboarding and portfolio assignment in a transaction
    const result = await prisma.$transaction(async (tx) => {
        // Create the client
        const client = await tx.client.create({
            data: {
                name: data.name,
                email: data.email || undefined,
                phone: data.phone || undefined,
                industry: data.industry || undefined,
            },
        });

        // Create onboarding record
        await tx.clientOnboarding.create({
            data: {
                clientId: client.id,
                status: 'DRAFT',
                onboardingData: (data.onboardingData || {}) as Prisma.InputJsonValue,
                targetLaunchDate: data.targetLaunchDate ? new Date(data.targetLaunchDate) : undefined,
                scripts: (data.scripts || {}) as Prisma.InputJsonValue,
                notes: data.notes || undefined,
                createdById: session.user.id,
            },
        });

        // Add to BD's portfolio
        await tx.businessDeveloperClient.create({
            data: {
                bdUserId: session.user.id,
                clientId: client.id,
            },
        });

        return client;
    });

    return successResponse(result, 201);
});
