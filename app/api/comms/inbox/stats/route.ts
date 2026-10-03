// ============================================
// API: /api/comms/inbox/stats
// Get inbox statistics (unread counts, etc.)
// ============================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInboxStats } from "@/lib/comms/service";

// GET /api/comms/inbox/stats - Get inbox statistics
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const stats = await getInboxStats(session.user.id);

        return NextResponse.json(stats);
    } catch (error) {
        console.error("Error fetching inbox stats:", error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération des statistiques" },
            { status: 500 }
        );
    }
}
