import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// ============================================
// Helper to verify BD has access to this client
// ============================================

async function verifyBDAccess(bdUserId: string, clientId: string): Promise<boolean> {
    const assignment = await prisma.businessDeveloperClient.findFirst({
        where: {
            bdUserId,
            clientId,
            isActive: true,
        },
    });
    return !!assignment;
}

// ============================================
// GET /api/bd/clients/[id] - Get client details
// ============================================

export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const session = await requireRole(['BUSINESS_DEVELOPER'], request);
    const { id } = await params;

    // Verify access
    const hasAccess = await verifyBDAccess(session.user.id, id);
    if (!hasAccess) {
        return errorResponse('Client non trouvé ou non autorisé', 404);
    }

    const client = await prisma.client.findUnique({
        where: { id },
        include: {
            onboarding: true,
            missions: {
                include: {
                    campaigns: {
                        select: {
                            id: true,
                            name: true,
                            isActive: true,
                        },
                    },
                    lists: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                        },
                    },
                    _count: {
                        select: {
                            sdrAssignments: true,
                            campaigns: true,
                            lists: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            },
            files: {
                take: 10,
                orderBy: { createdAt: 'desc' },
            },
            _count: {
                select: {
                    missions: true,
                    users: true,
                    files: true,
                },
            },
        },
    });

    if (!client) {
        return errorResponse('Client non trouvé', 404);
    }

    return successResponse(client);
});

// ============================================
// PUT /api/bd/clients/[id] - Update client and onboarding
// ============================================

const updateClientSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    // Onboarding fields
    onboardingStatus: z.enum(['DRAFT', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'APPROVED', 'ACTIVE']).optional(),
    onboardingData: z.record(z.string(), z.unknown()).optional(),
    targetLaunchDate: z.string().optional().nullable(),
    scripts: z.record(z.string(), z.unknown()).optional(),
    notes: z.string().optional().nullable(),
});

export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const session = await requireRole(['BUSINESS_DEVELOPER'], request);
    const { id } = await params;
    const data = await validateRequest(request, updateClientSchema);

    // Verify access
    const hasAccess = await verifyBDAccess(session.user.id, id);
    if (!hasAccess) {
        return errorResponse('Client non trouvé ou non autorisé', 404);
    }

    // Update client and onboarding in transaction
    const result = await prisma.$transaction(async (tx) => {
        // Update client basic info
        const client = await tx.client.update({
            where: { id },
            data: {
                name: data.name,
                email: data.email,
                phone: data.phone,
                industry: data.industry,
            },
        });

        // Update onboarding if any onboarding fields provided
        if (data.onboardingStatus || data.onboardingData || data.targetLaunchDate !== undefined || data.scripts || data.notes !== undefined) {
            await tx.clientOnboarding.upsert({
                where: { clientId: id },
                create: {
                    clientId: id,
                    status: data.onboardingStatus || 'DRAFT',
                    onboardingData: (data.onboardingData || {}) as Prisma.InputJsonValue,
                    targetLaunchDate: data.targetLaunchDate ? new Date(data.targetLaunchDate) : undefined,
                    scripts: (data.scripts || {}) as Prisma.InputJsonValue,
                    notes: data.notes || undefined,
                    createdById: session.user.id,
                    completedAt: data.onboardingStatus === 'ACTIVE' ? new Date() : undefined,
                },
                update: {
                    status: data.onboardingStatus,
                    onboardingData: data.onboardingData as Prisma.InputJsonValue | undefined,
                    targetLaunchDate: data.targetLaunchDate ? new Date(data.targetLaunchDate) : undefined,
                    scripts: data.scripts as Prisma.InputJsonValue | undefined,
                    notes: data.notes,
                    completedAt: data.onboardingStatus === 'ACTIVE' ? new Date() : undefined,
                },
            });
        }

        return client;
    });

    return successResponse(result);
});
