import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ============================================
// SCHEMAS
// ============================================

const updatePreferencesSchema = z.object({
    selectedMissionId: z.string().optional(),
    selectedListId: z.string().optional(),
});

// ============================================
// GET /api/sdr/preferences
// Get SDR preferences
// ============================================

export async function GET(request: NextRequest) {
    try {
        const session = await requireAuth(request);

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                selectedMissionId: true,
                selectedListId: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Utilisateur non trouvé" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                selectedMissionId: user.selectedMissionId,
                selectedListId: user.selectedListId,
            },
        });
    } catch (error) {
        console.error("Error getting preferences:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}

// ============================================
// PUT /api/sdr/preferences
// Update SDR preferences
// ============================================

export async function PUT(request: NextRequest) {
    try {
        const session = await requireAuth(request);

        const body = await request.json();
        const parsed = updatePreferencesSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Données invalides" },
                { status: 400 }
            );
        }

        const { selectedMissionId, selectedListId } = parsed.data;

        // Validate mission access if provided
        if (selectedMissionId) {
            const assignment = await prisma.sDRAssignment.findFirst({
                where: {
                    sdrId: session.user.id,
                    missionId: selectedMissionId,
                },
            });

            if (!assignment) {
                return NextResponse.json(
                    { success: false, error: "Mission non accessible" },
                    { status: 403 }
                );
            }
        }

        // Validate list access if provided
        if (selectedListId) {
            const list = await prisma.list.findFirst({
                where: {
                    id: selectedListId,
                    mission: {
                        sdrAssignments: {
                            some: {
                                sdrId: session.user.id,
                            },
                        },
                    },
                },
            });

            if (!list) {
                return NextResponse.json(
                    { success: false, error: "Liste non accessible" },
                    { status: 403 }
                );
            }
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                selectedMissionId,
                selectedListId,
            },
        });

        return NextResponse.json({
            success: true,
            message: "Préférences mises à jour",
        });
    } catch (error) {
        console.error("Error updating preferences:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
