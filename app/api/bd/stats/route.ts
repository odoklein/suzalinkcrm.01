import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';

// ============================================
// GET /api/bd/stats - Get BD dashboard stats
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['BUSINESS_DEVELOPER'], request);

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
        return successResponse({
            totalClients: 0,
            activeClients: 0,
            pendingOnboarding: 0,
            totalMissions: 0,
        });
    }

    // Count stats
    const [totalClients, onboardingStats, missionStats] = await Promise.all([
        prisma.client.count({
            where: { id: { in: clientIds } },
        }),
        prisma.clientOnboarding.groupBy({
            by: ['status'],
            where: { clientId: { in: clientIds } },
            _count: true,
        }),
        prisma.mission.count({
            where: {
                clientId: { in: clientIds },
                isActive: true,
            },
        }),
    ]);

    // Calculate active clients (those with ACTIVE or APPROVED onboarding status)
    const activeStatuses = ['ACTIVE', 'APPROVED'];
    const activeClients = onboardingStats
        .filter(s => activeStatuses.includes(s.status))
        .reduce((acc, s) => acc + s._count, 0);

    // Calculate pending onboarding (DRAFT, IN_PROGRESS, READY_FOR_REVIEW)
    const pendingStatuses = ['DRAFT', 'IN_PROGRESS', 'READY_FOR_REVIEW'];
    const pendingOnboarding = onboardingStats
        .filter(s => pendingStatuses.includes(s.status))
        .reduce((acc, s) => acc + s._count, 0);

    return successResponse({
        totalClients,
        activeClients,
        pendingOnboarding,
        totalMissions: missionStats,
    });
});
