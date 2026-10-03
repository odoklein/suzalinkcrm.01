import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-utils";
import { startSession } from "@/lib/activity/session-manager";

// ============================================
// POST /api/sdr/activity/start - Start activity session
// ============================================

export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(["SDR", "BUSINESS_DEVELOPER", "BOOKER"], request);

        const userId = session.user.id;

        // Use session manager to start session
        const result = await startSession(userId);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: "Failed to start session" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                isActive: true,
                totalActiveSecondsToday: result.totalActiveSeconds,
                currentSessionStartedAt: result.currentSessionStartedAt?.toISOString(),
            },
        });

    } catch (error) {
        console.error("[POST /api/sdr/activity/start] Error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
