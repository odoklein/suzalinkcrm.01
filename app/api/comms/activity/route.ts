// ============================================
// ACTIVITY FEED API
// Get recent communication activity
// ============================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCommsActivity } from "@/lib/comms/activity";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const activities = await getCommsActivity(session.user.id);
        return NextResponse.json(activities);
    } catch (error) {
        console.error("Error fetching activity feed:", error);
        return NextResponse.json(
            { error: "Failed to fetch activity feed" },
            { status: 500 }
        );
    }
}
