"use server";

import { prisma } from "@/lib/prisma";
import { searchExploriumCompanies, getExploriumStats, ExploriumSearchFilters } from "@/lib/explorium";
import { enrichmentQueue } from "@/lib/bullmq";
import { Channel } from "@prisma/client";
import type { MissionStatusValue } from "@/lib/constants/missionStatus";
import { revalidatePath } from "next/cache";

// ============================================
// TYPES
// ============================================

export interface CreateMissionInput {
    // Mission fields
    name: string;
    objective: string;
    channel: Channel;
    channels?: Channel[];
    status?: MissionStatusValue;
    clientId: string;
    startDate: string;
    endDate: string;
    // Campaign fields (unified creation)
    icp: string;
    pitch: string;
    scriptIntro: string;
    scriptDiscovery: string;
    scriptObjection: string;
    scriptClosing: string;
}

// ============================================
// EXPORTS
// ============================================

/**
 * Server Action to get market size stats via Explorium
 */
export async function getMarketStats(filters: ExploriumSearchFilters) {
    try {
        const stats = await getExploriumStats(filters);
        return { success: true, data: stats };
    } catch (error) {
        console.error("Stats failed:", error);
        return { success: false, error: "Failed to get market stats" };
    }
}

/**
 * Server Action to search companies via Explorium
 */
export async function searchCompanies(filters: ExploriumSearchFilters) {
    try {
        const results = await searchExploriumCompanies(filters);
        return { success: true, data: results };
    } catch (error) {
        console.error("Search failed:", error);
        return { success: false, error: "Failed to search companies" };
    }
}

/**
 * Server Action to create mission + campaign in a single transaction
 */
export async function createMission(
    missionData: CreateMissionInput
) {
    try {
        console.log("Creating mission + campaign...", missionData);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Mission
            const channels = missionData.channels?.length ? missionData.channels : [missionData.channel];
            const channel = channels[0];
            const mission = await tx.mission.create({
                data: {
                    name: missionData.name,
                    objective: missionData.objective,
                    channel,
                    channels,
                    clientId: missionData.clientId,
                    startDate: new Date(missionData.startDate),
                    endDate: new Date(missionData.endDate),
                    status: missionData.status ?? "DRAFT",
                    isActive: (missionData.status ?? "DRAFT") === "ACTIVE",
                },
            });

            // 2. Create default Campaign linked to the mission
            const script = JSON.stringify({
                intro: missionData.scriptIntro || "",
                discovery: missionData.scriptDiscovery || "",
                objection: missionData.scriptObjection || "",
                closing: missionData.scriptClosing || "",
            });

            await tx.campaign.create({
                data: {
                    name: missionData.name, // Same name as mission
                    missionId: mission.id,
                    icp: missionData.icp || "",
                    pitch: missionData.pitch || "",
                    script,
                    isActive: true,
                },
            });

            return mission;
        });

        console.log("Mission + campaign created:", result.id);

        // Revalidate
        revalidatePath("/manager/missions");
        revalidatePath(`/manager/missions/${result.id}`);

        return { 
            success: true, 
            missionId: result.id,
            message: "Mission créée avec succès."
        };
    } catch (error) {
        console.error("Failed to create mission:", error);
        return { success: false, error: "Failed to create mission" };
    }
}
