import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActivityStatus } from "@/lib/activity/status-resolver";

// ============================================
// GET /api/sdr/activity/batch?userIds=id1,id2,id3
// Returns activity status for multiple users in one call (avoids N+1 on team page)
// Now includes auto-pause logic and richer status information
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
        if (session.user.role !== "MANAGER") {
            return NextResponse.json(
                { success: false, error: "Réservé aux managers" },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const userIdsParam = searchParams.get("userIds");
        const userIds = userIdsParam ? userIdsParam.split(",").filter(Boolean).slice(0, 50) : [];

        if (userIds.length === 0) {
            return NextResponse.json({ success: true, data: {} });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = new Date();

        const activities = await prisma.crmActivityDay.findMany({
            where: {
                userId: { in: userIds },
                date: today,
            },
        });

        // Build result map with richer status information
        const byUserId: Record<string, {
            isActive: boolean;
            status: string;
            lastSeenMinutesAgo: number | null;
        }> = {};

        // Initialize all users as offline
        for (const uid of userIds) {
            byUserId[uid] = {
                isActive: false,
                status: 'offline',
                lastSeenMinutesAgo: null,
            };
        }

        // Update with actual activity data
        for (const activity of activities) {
            const statusResult = resolveActivityStatus(activity, null, now);
            byUserId[activity.userId] = {
                isActive: statusResult.isActive,
                status: statusResult.displayStatus,
                lastSeenMinutesAgo: statusResult.lastSeenMinutesAgo,
            };
        }

        return NextResponse.json({ success: true, data: byUserId });
    } catch (error) {
        console.error("[GET /api/sdr/activity/batch] Error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
