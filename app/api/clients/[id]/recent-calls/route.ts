import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
    AuthError,
} from "@/lib/api-utils";

// ============================================
// GET /api/clients/[id]/recent-calls
// Recent call outcomes for client's missions. No SDR/BD info exposed.
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(["MANAGER", "CLIENT"], request);
    const { id: clientId } = await params;

    if (session.user.role === "CLIENT") {
        if ((session.user as { clientId?: string }).clientId !== clientId) {
            throw new AuthError("Accès non autorisé", 403);
        }
    }

    const client = await prisma.client.findUnique({
        where: { id: clientId },
    });
    if (!client) {
        throw new NotFoundError("Client introuvable");
    }

    const missions = await prisma.mission.findMany({
        where: { clientId },
        select: { id: true },
    });
    const missionIds = missions.map((m) => m.id);
    if (missionIds.length === 0) {
        return successResponse({ calls: [], total: 0 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all"; // all | companies | contacts
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 200);
    const offset = parseInt(searchParams.get("offset") || "0") || 0;

    const where: Prisma.ActionWhereInput = {
        campaign: { missionId: { in: missionIds } },
    };
    if (filter === "companies") {
        where.companyId = { not: null };
    } else if (filter === "contacts") {
        where.contactId = { not: null };
    }

    const actions = await prisma.action.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            createdAt: true,
            result: true,
            note: true,
            contactId: true,
            companyId: true,
            contact: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    title: true,
                    company: { select: { id: true, name: true } },
                },
            },
            company: {
                select: { id: true, name: true },
            },
            campaign: {
                select: {
                    id: true,
                    name: true,
                    mission: { select: { id: true, name: true } },
                },
            },
        },
    });

    const total = await prisma.action.count({ where });

    // Strip any accidental sdr reference; shape for client (no user/sdr)
    const calls = actions.map((a) => ({
        id: a.id,
        createdAt: a.createdAt,
        result: a.result,
        note: a.note ?? undefined,
        contact: a.contact
            ? {
                id: a.contact.id,
                firstName: a.contact.firstName,
                lastName: a.contact.lastName,
                title: a.contact.title,
                company: a.contact.company,
            }
            : undefined,
        company: a.company ?? undefined,
        campaign: a.campaign
            ? {
                id: a.campaign.id,
                name: a.campaign.name,
                mission: a.campaign.mission,
            }
            : undefined,
    }));

    return successResponse({ calls, total });
});
