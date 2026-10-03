import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    withErrorHandler,
    requireRole,
    NotFoundError,
    AuthError,
} from "@/lib/api-utils";

/**
 * DELETE /api/client/meetings/[id] - Remove (delete) a meeting
 * Authorized for CLIENT users belonging to the meeting's client company
 */
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(["CLIENT"], request);
    const { id: actionId } = await params;

    const action = await prisma.action.findUnique({
        where: { id: actionId },
        include: {
            campaign: {
                include: {
                    mission: {
                        include: {
                            client: {
                                include: { users: { select: { id: true } } },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!action) {
        throw new NotFoundError("Action introuvable");
    }

    if (action.confirmationStatus !== "CONFIRMED") {
        throw new AuthError("Ce rendez-vous n'est pas encore confirmé", 403);
    }

    if (action.result !== "MEETING_BOOKED" && action.result !== "MEETING_CANCELLED") {
        return new Response(
            JSON.stringify({ success: false, error: "Seuls les rendez-vous peuvent être supprimés" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const client = action.campaign.mission.client;
    if (!client) {
        throw new NotFoundError("Client introuvable pour ce rendez-vous");
    }

    const clientUserIds = client.users.map((u) => u.id);
    if (!clientUserIds.includes(session.user.id)) {
        throw new AuthError("Non autorisé à supprimer ce rendez-vous", 403);
    }

    await prisma.action.delete({ where: { id: actionId } });

    return new Response(null, { status: 204 });
});
