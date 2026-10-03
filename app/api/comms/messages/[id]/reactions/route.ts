// ============================================
// API: /api/comms/messages/[id]/reactions
// Toggle reaction on a message
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addOrRemoveReaction } from "@/lib/comms/service";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { id: messageId } = await params;
        const body = await request.json();
        const emoji = body.emoji as string | undefined;

        if (!emoji || typeof emoji !== "string") {
            return NextResponse.json(
                { error: "emoji est requis" },
                { status: 400 }
            );
        }

        const result = await addOrRemoveReaction(
            messageId,
            session.user.id,
            emoji.trim()
        );

        return NextResponse.json({ result });
    } catch (error) {
        console.error("Error toggling reaction:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erreur" },
            { status: 500 }
        );
    }
}
