/**
 * RDV count service — count MEETING_BOOKED actions by client and period
 * Used for engagement-based invoice generation and UI breakdown.
 */

import { prisma } from "@/lib/prisma";

export interface MissionRdvBreakdown {
    missionId: string;
    missionName: string;
    rdvCount: number;
}

export interface RdvCountResult {
    total: number;
    byMission: MissionRdvBreakdown[];
}

/**
 * Get RDV count for a client in a given month (total + per-mission breakdown).
 * RDVs = Action with result MEETING_BOOKED under Campaign → Mission → clientId, createdAt in [periodStart, periodEnd].
 */
export async function getRdvCountForClient(
    clientId: string,
    periodStart: Date,
    periodEnd: Date
): Promise<RdvCountResult> {
    const periodEndEod = new Date(periodEnd);
    periodEndEod.setHours(23, 59, 59, 999);

    const actions = await prisma.action.findMany({
        where: {
            result: "MEETING_BOOKED",
            campaign: {
                mission: {
                    clientId,
                },
            },
            createdAt: {
                gte: periodStart,
                lte: periodEndEod,
            },
        },
        select: {
            id: true,
            campaignId: true,
            campaign: {
                select: {
                    missionId: true,
                    mission: {
                        select: { id: true, name: true },
                    },
                },
            },
        },
    });

    const byMissionMap = new Map<string, { missionName: string; count: number }>();
    for (const a of actions) {
        const missionId = a.campaign.mission.id;
        const missionName = a.campaign.mission.name;
        const existing = byMissionMap.get(missionId);
        if (existing) {
            existing.count += 1;
        } else {
            byMissionMap.set(missionId, { missionName, count: 1 });
        }
    }

    const byMission: MissionRdvBreakdown[] = Array.from(byMissionMap.entries()).map(
        ([missionId, { missionName, count }]) => ({
            missionId,
            missionName,
            rdvCount: count,
        })
    );

    return {
        total: actions.length,
        byMission,
    };
}
