import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pauseSession } from "@/lib/activity/session-manager";
import { resolveActivityStatus, shouldAutoPause } from "@/lib/activity/status-resolver";

// ============================================
// GET /api/sdr/activity - Get activity status
// For SDR: returns own status
// For Manager: ?userId=XXX returns that user's status
// ============================================

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get("userId");

        // If userId is provided, require MANAGER role
        if (targetUserId && session.user.role !== "MANAGER") {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 403 }
            );
        }

        const userId = targetUserId || session.user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = new Date();

        // Get or create today's activity record
        let activity = await prisma.crmActivityDay.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
        });

        if (!activity) {
            activity = await prisma.crmActivityDay.create({
                data: {
                    userId,
                    date: today,
                    totalActiveSeconds: 0,
                    currentSessionStartedAt: null,
                    lastActivityAt: null,
                    sessionCount: 0,
                    longestSessionSeconds: 0,
                },
            });
        }

        // Auto-pause check: if session is active but should be paused
        if (activity && shouldAutoPause(activity, now)) {
            console.log(`[GET Activity] Auto-pausing session for user ${userId}`);
            const pauseResult = await pauseSession(userId);

            return NextResponse.json({
                success: true,
                data: {
                    isActive: false,
                    totalActiveSecondsToday: pauseResult.totalActiveSeconds,
                    currentSessionStartedAt: null,
                    lastActivityAt: activity.lastActivityAt?.toISOString() || null,
                    autoPaused: true,
                },
            });
        }

        // Resolve status using centralized logic
        const statusResult = resolveActivityStatus(activity, null, now);

        return NextResponse.json({
            success: true,
            data: {
                isActive: statusResult.isActive,
                totalActiveSecondsToday: activity.totalActiveSeconds,
                currentSessionStartedAt: activity.currentSessionStartedAt?.toISOString() || null,
                lastActivityAt: activity.lastActivityAt?.toISOString() || null,
                status: statusResult.displayStatus,
                lastSeenMinutesAgo: statusResult.lastSeenMinutesAgo,
            },
        });

    } catch (error) {
        console.error("[GET /api/sdr/activity] Error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
