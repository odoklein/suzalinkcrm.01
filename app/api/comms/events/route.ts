// ============================================
// API: /api/comms/events
// REST polling endpoint (replaces long-lived SSE on serverless).
// VoIP enrichment events removed with the VoIP stack; returns empty events.
// ============================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json({
            success: true,
            data: {
                events: [] as unknown[],
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Error fetching comms events:", error);
        return NextResponse.json(
            { error: "Failed to fetch events" },
            { status: 500 }
        );
    }
}
