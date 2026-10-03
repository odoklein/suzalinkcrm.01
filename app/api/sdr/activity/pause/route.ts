import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-utils";
import { pauseSession } from "@/lib/activity/session-manager";

// ============================================
// POST /api/sdr/activity/pause - Pause current session
// ============================================

export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(["SDR", "BUSINESS_DEVELOPER", "BOOKER"], request);

        const userId = session.user.id;

        // Use session manager for transaction-safe pause
        const result = await pauseSession(userId);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error || "Failed to pause session" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                isActive: false,
                totalActiveSecondsToday: result.totalActiveSeconds,
                sessionSeconds: result.sessionSeconds,
                wasCapped: result.wasCapped,
            },
        });

    } catch (error) {
        console.error("[POST /api/sdr/activity/pause] Error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
