import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { pauseSession, updateLastActivity } from "@/lib/activity/session-manager";
import { shouldAutoPause } from "@/lib/activity/status-resolver";
import { ACTIVITY_LIMITS } from "@/lib/activity/constants";

// ============================================
// POST /api/sdr/activity/heartbeat - Update last activity
// Also handles auto-pause if last activity was > 5 min ago
// ============================================

export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(["SDR", "BUSINESS_DEVELOPER", "BOOKER"], request);

        const userId = session.user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = new Date();

        // Get current activity
        const activity = await prisma.crmActivityDay.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
        });

        // Check if we need to auto-pause
        if (activity && shouldAutoPause(activity, now)) {
            console.log(`[Heartbeat] Auto-pausing session for user ${userId}`);

            // Pause the session
            const pauseResult = await pauseSession(userId);

            return NextResponse.json({
                success: true,
                data: {
                    isActive: false,
                    totalActiveSecondsToday: pauseResult.totalActiveSeconds,
                    currentSessionStartedAt: null,
                    autoPaused: true,
                },
            });
        }

        // Update last activity timestamp
        const result = await updateLastActivity(userId);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: "Failed to update activity" },
                { status: 500 }
            );
        }

        // Re-fetch to get current state
        const updatedActivity = await prisma.crmActivityDay.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
        });

        const isActive = updatedActivity?.currentSessionStartedAt !== null &&
            updatedActivity?.lastActivityAt !== null &&
            (now.getTime() - updatedActivity.lastActivityAt.getTime()) < ACTIVITY_LIMITS.INACTIVITY_THRESHOLD_MS;

        return NextResponse.json({
            success: true,
            data: {
                isActive,
                totalActiveSecondsToday: updatedActivity?.totalActiveSeconds || 0,
                currentSessionStartedAt: updatedActivity?.currentSessionStartedAt?.toISOString() || null,
                autoPaused: false,
            },
        });

    } catch (error) {
        console.error("[POST /api/sdr/activity/heartbeat] Error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
