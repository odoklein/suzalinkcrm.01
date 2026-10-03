// ============================================
// GET /api/support/upcoming-meetings
// Lightweight list of upcoming RDV for the client support panel's
// "@RDV" context chips. Returns at most 6 items.
// ============================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT", "COMMERCIAL"], request);
    const clientId = session.user.clientId;
    if (!clientId) {
        return successResponse({ meetings: [] });
    }

    const missions = await prisma.mission.findMany({
        where: { clientId },
        select: { id: true },
    });
    const missionIds = missions.map((m) => m.id);
    if (missionIds.length === 0) {
        return successResponse({ meetings: [] });
    }

    const now = new Date();
    const actions = await prisma.action.findMany({
        where: {
            result: "MEETING_BOOKED",
            confirmationStatus: "CONFIRMED",
            callbackDate: { gte: now },
            campaign: { missionId: { in: missionIds } },
        },
        orderBy: { callbackDate: "asc" },
        take: 6,
        select: {
            id: true,
            callbackDate: true,
            contact: {
                select: {
                    firstName: true,
                    lastName: true,
                    company: { select: { name: true } },
                },
            },
            company: { select: { name: true } },
        },
    });

    const meetings = actions.map((a) => {
        const companyName =
            a.contact?.company?.name ?? a.company?.name ?? "Contact";
        const date = a.callbackDate ?? new Date();
        const label = `${companyName} · ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
        return { id: a.id, label, date: date.toISOString() };
    });

    return successResponse({ meetings });
});
