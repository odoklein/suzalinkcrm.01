// ============================================
// API: /api/comms/threads
// List threads (inbox) and create new threads
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
    getInboxThreads,
    createThread,
    canAccessChannel,
} from "@/lib/comms/service";
import type {
    CreateThreadRequest,
    CommsInboxFilters,
    CommsChannelType,
    CommsThreadStatus,
} from "@/lib/comms/types";

const CLIENT_SUPPORT_TEAM_NAME_MATCHERS = ["roeum", "hichem", "jeff", "sophie"];

// GET /api/comms/threads - List threads (inbox)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1", 10);
        const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

        const filters: CommsInboxFilters = {
            type: searchParams.get("type") as CommsChannelType | undefined,
            status: searchParams.get("status") as CommsThreadStatus | undefined,
            unreadOnly: searchParams.get("unreadOnly") === "true",
            search: searchParams.get("search") || undefined,
        };

        // Clients can only see DIRECT threads (managers only, no mission chat)
        if (session.user.role === "CLIENT") {
            filters.type = "DIRECT";
        }

        const result = await getInboxThreads(session.user.id, filters, page, pageSize);

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching threads:", error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération des discussions" },
            { status: 500 }
        );
    }
}

// POST /api/comms/threads - Create a new thread
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const body: CreateThreadRequest = await request.json();

        // Validate required fields
        if (!body.channelType || !body.subject || !body.initialMessage) {
            return NextResponse.json(
                { error: "channelType, subject, and initialMessage are required" },
                { status: 400 }
            );
        }

        // Check permission to create thread in this channel
        const canAccess = await canAccessChannel(
            session.user.id,
            session.user.role,
            body.channelType,
            body.anchorId
        );

        if (!canAccess) {
            return NextResponse.json(
                { error: "Vous n'avez pas accès à ce canal" },
                { status: 403 }
            );
        }

        // Only managers can create broadcasts
        if (body.isBroadcast && session.user.role !== "MANAGER") {
            return NextResponse.json(
                { error: "Seuls les managers peuvent créer des annonces" },
                { status: 403 }
            );
        }

        // Client portal: direct messages only to managers (messaging is only in mission or to a manager)
        if (session.user.role === "CLIENT" && body.channelType === "DIRECT") {
            const participantIds = body.participantIds ?? [];
            if (participantIds.length < 1) {
                return NextResponse.json(
                    { error: "Un message direct doit avoir au moins un destinataire" },
                    { status: 400 }
                );
            }

            const supportUsers = await prisma.user.findMany({
                where: {
                    isActive: true,
                    OR: CLIENT_SUPPORT_TEAM_NAME_MATCHERS.map((name) => ({
                        name: { contains: name, mode: "insensitive" },
                    })),
                },
                select: { id: true },
            });
            const supportIds = supportUsers.map((u) => u.id);
            if (supportIds.length === 0) {
                return NextResponse.json(
                    { error: "Aucun membre de l'équipe support n'est configuré" },
                    { status: 500 }
                );
            }

            const dedupedParticipantIds = [...new Set(participantIds)];
            const missingSupportMembers = supportIds.filter((id) => !dedupedParticipantIds.includes(id));
            const hasNonSupportRecipient = dedupedParticipantIds.some((id) => !supportIds.includes(id));

            if (missingSupportMembers.length > 0 || hasNonSupportRecipient) {
                return NextResponse.json(
                    { error: "Les clients ne peuvent envoyer ce message qu'à l'équipe support complète" },
                    { status: 403 }
                );
            }

            body.participantIds = dedupedParticipantIds;
        }

        const threadId = await createThread(body, session.user.id);

        return NextResponse.json({ id: threadId }, { status: 201 });
    } catch (error) {
        console.error("Error creating thread:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erreur lors de la création" },
            { status: 500 }
        );
    }
}
