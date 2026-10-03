// ============================================
// GET /api/client/contactable-sdrs
// SDRs assigned to any of the current client's missions (for contact page)
// ============================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }
        if (session.user.role !== "CLIENT") {
            return NextResponse.json({ error: "Réservé aux clients" }, { status: 403 });
        }

        // Get user's clientId
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { clientId: true },
        });
        if (!user?.clientId) {
            return NextResponse.json({ sdrs: [], missions: [] });
        }

        // Missions for this client (active)
        const missions = await prisma.mission.findMany({
            where: {
                clientId: user.clientId,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                sdrAssignments: {
                    include: {
                        sdr: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });

        // Unique SDRs across all missions
        const sdrMap = new Map<string, { id: string; name: string; missionIds: string[] }>();
        for (const m of missions) {
            for (const a of m.sdrAssignments) {
                const sdr = a.sdr;
                if (!sdrMap.has(sdr.id)) {
                    sdrMap.set(sdr.id, {
                        id: sdr.id,
                        name: sdr.name,
                        missionIds: [],
                    });
                }
                sdrMap.get(sdr.id)!.missionIds.push(m.id);
            }
        }

        const sdrs = Array.from(sdrMap.values());

        return NextResponse.json({
            sdrs,
            missions: missions.map((m) => ({
                id: m.id,
                name: m.name,
                sdrCount: m.sdrAssignments.length,
            })),
        });
    } catch (error) {
        console.error("Error fetching contactable SDRs:", error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération des contacts" },
            { status: 500 }
        );
    }
}
