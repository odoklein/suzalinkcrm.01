// ============================================
// API: /api/comms/typing
// POST - Broadcast typing start/stop to thread participants
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishTyping } from "@/lib/comms/realtime";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const body = await request.json();
        const threadId = body.threadId as string | undefined;
        const isTyping = !!body.isTyping;

        if (!threadId) {
            return NextResponse.json(
                { error: "threadId est requis" },
                { status: 400 }
            );
        }

        const participant = await prisma.commsParticipant.findUnique({
            where: {
                threadId_userId: { threadId, userId: session.user.id },
            },
        });

        if (!participant) {
            return NextResponse.json(
                { error: "Vous n'êtes pas participant de cette discussion" },
                { status: 403 }
            );
        }

        await publishTyping(
            threadId,
            session.user.id,
            session.user.name ?? "Utilisateur",
            isTyping
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error publishing typing:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'envoi du statut" },
            { status: 500 }
        );
    }
}
