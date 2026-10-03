// ============================================
// THREAD ANALYTICS API
// Get metrics for a specific thread
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getThreadAnalytics } from "@/lib/comms/analytics";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: threadId } = await params;

        const analytics = await getThreadAnalytics(threadId);
        return NextResponse.json(analytics);
    } catch (error) {
        console.error("Analytics error:", error);
        return NextResponse.json(
            { error: "Failed to fetch thread analytics" },
            { status: 500 }
        );
    }
}
