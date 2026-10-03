import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requirePlanningAccess,
    withErrorHandler,
} from '@/lib/api-utils';

// ============================================
// GET /api/planning/sdrs - Get team members (SDR + BD) for planning
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requirePlanningAccess(request);

    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role'); // Optional filter: SDR, BUSINESS_DEVELOPER, or null for all

    // Build role filter
    const roleCondition = roleFilter
        ? { role: roleFilter as any }
        : { role: { in: ['SDR' as any, 'BUSINESS_DEVELOPER' as any] } };

    // Get all SDRs and BDs with their mission assignments
    const teamMembers = await prisma.user.findMany({
        where: roleCondition,
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            assignedMissions: {
                include: {
                    mission: {
                        select: {
                            id: true,
                            name: true,
                            channel: true,
                            status: true,
                            client: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            },
            // For BDs, also get their portfolio clients and their missions
            bdPortfolio: {
                where: { isActive: true },
                include: {
                    client: {
                        select: {
                            id: true,
                            name: true,
                            missions: {
                                where: { status: 'ACTIVE' },
                                select: {
                                    id: true,
                                    name: true,
                                    channel: true,
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: [
            { role: 'asc' },
            { name: 'asc' },
        ],
    });

    // Transform data for easier consumption
    const transformed = teamMembers.map(member => {
        // For SDRs, use their assigned missions
        // For BDs, combine assigned missions + missions from their portfolio clients
        let missions = member.assignedMissions
            .filter(a => a.mission.status === 'ACTIVE')
            .map(a => ({
                id: a.mission.id,
                name: a.mission.name,
                channel: a.mission.channel,
                clientName: a.mission.client.name,
            }));

        // For BDs, add missions from their portfolio
        if (member.role === 'BUSINESS_DEVELOPER' && member.bdPortfolio) {
            const portfolioMissions = member.bdPortfolio.flatMap(p =>
                p.client.missions.map(m => ({
                    id: m.id,
                    name: m.name,
                    channel: m.channel,
                    clientName: p.client.name,
                }))
            );

            // Merge and dedupe
            const existingIds = new Set(missions.map(m => m.id));
            const uniquePortfolioMissions = portfolioMissions.filter(m => !existingIds.has(m.id));
            missions = [...missions, ...uniquePortfolioMissions];
        }

        return {
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role,
            missions,
        };
    });

    return successResponse(transformed);
});
