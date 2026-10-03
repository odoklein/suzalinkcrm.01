// ============================================
// API: /api/comms/threads/[id]
// Get, update, and manage individual threads
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getThread, updateThreadStatus } from "@/lib/comms/service";
import { publishThreadStatusUpdated } from "@/lib/comms/realtime";
import type { CommsThreadStatus } from "@/lib/comms/types";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/comms/threads/[id] - Get thread with messages
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const thread = await getThread(id, session.user.id);

        if (!thread) {
            return NextResponse.json(
                { error: "Discussion non trouvée" },
                { status: 404 }
            );
        }

        return NextResponse.json(thread);
    } catch (error) {
        console.error("Error fetching thread:", error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération de la discussion" },
            { status: 500 }
        );
    }
}

// PATCH /api/comms/threads/[id] - Update thread (status, etc.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        if (body.status) {
            const validStatuses: CommsThreadStatus[] = ["OPEN", "RESOLVED", "ARCHIVED"];
            if (!validStatuses.includes(body.status)) {
                return NextResponse.json(
                    { error: "Statut invalide" },
                    { status: 400 }
                );
            }

            await updateThreadStatus(id, body.status, session.user.id);
            await publishThreadStatusUpdated(id, body.status);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating thread:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour" },
            { status: 500 }
        );
    }
}
