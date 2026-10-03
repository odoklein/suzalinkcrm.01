import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusConfigService } from "@/lib/services/StatusConfigService";

// ============================================
// GET /api/sdr/callbacks/count
// Get callback count for SDR's assigned mission only (for sidebar badge)
// Query params:
//   - assignedOnly=true: only count callbacks for the SDR's currently assigned mission
// ============================================

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const assignedOnly = searchParams.get("assignedOnly") === "true";

        const userRole = (session.user as { role?: string }).role;
        const isBusinessDeveloper = userRole === "BUSINESS_DEVELOPER";
        const isBooker = userRole === "BOOKER";
        const isSdr = userRole === "SDR";

        const callbackStatusCodes = new Set<string>(["CALLBACK_REQUESTED", "RELANCE", "RAPPEL"]);
        try {
            const cfg = await statusConfigService.getEffectiveStatusConfig({});
            for (const status of cfg.statuses) {
                if (status.triggersCallback) callbackStatusCodes.add(status.code);
            }
        } catch {
            // Keep default callback codes if config lookup fails.
        }

        // For sidebar badge: only show callbacks from the SDR's assigned mission
        if (assignedOnly && isSdr) {
            // Get the SDR's current assigned mission (their active planning)
            const assignment = await prisma.sDRAssignment.findFirst({
                where: { 
                    sdrId: session.user.id,
                },
                select: { missionId: true },
                orderBy: { createdAt: 'desc' },
            });

            // If no assignment, show all callbacks for this SDR (fallback)
            const whereClause: {
                sdrId: string;
                result: { in: string[] };
                campaign?: { missionId: string };
            } = {
                sdrId: session.user.id,
                result: { in: Array.from(callbackStatusCodes) },
            };

            // If they have an assignment, filter by that mission
            if (assignment) {
                whereClause.campaign = { missionId: assignment.missionId };
            }

            const callbacks = await prisma.action.findMany({
                where: whereClause,
                select: {
                    id: true,
                    callbackDate: true,
                    createdAt: true,
                    contactId: true,
                    companyId: true,
                },
                orderBy: [
                    { callbackDate: 'asc' },
                    { createdAt: 'desc' },
                ],
                take: 200,
            });

            // Filter out superseded callbacks
            if (callbacks.length === 0) {
                return NextResponse.json({
                    success: true,
                    count: 0,
                    nextCallbackDate: null,
                });
            }

            const callbackIds = callbacks.map((c) => c.id);
            const superseded = await prisma.$queryRaw<{ id: string }[]>`
                SELECT a.id FROM "Action" a
                WHERE a.id IN (${Prisma.join(callbackIds)})
                AND (
                    (a."contactId" IS NOT NULL AND EXISTS (SELECT 1 FROM "Action" b WHERE b."contactId" = a."contactId" AND b."createdAt" > a."createdAt"))
                    OR
                    (a."companyId" IS NOT NULL AND EXISTS (SELECT 1 FROM "Action" b WHERE b."companyId" = a."companyId" AND b."createdAt" > a."createdAt"))
                )
            `;
            const supersededSet = new Set(superseded.map((r) => r.id));

            const activeCallbacks = callbacks.filter((c) => !supersededSet.has(c.id));

            // Find next callback date
            const now = new Date();
            const futureCallbacks = activeCallbacks
                .filter((c) => c.callbackDate && new Date(c.callbackDate) >= now)
                .map((c) => new Date(c.callbackDate!))
                .sort((a, b) => a.getTime() - b.getTime());

            return NextResponse.json({
                success: true,
                count: activeCallbacks.length,
                nextCallbackDate: futureCallbacks[0]?.toISOString() ?? null,
            });
        }

        // For BD/Booker or non-assignedOnly: count all callbacks they have access to
        const assignedMissionIds = isBooker
            ? []
            : (
                  await prisma.sDRAssignment.findMany({
                      where: { sdrId: session.user.id },
                      select: { missionId: true },
                  })
              ).map((a) => a.missionId);

        const teamLeadMissions = await prisma.mission.findMany({
            where: { teamLeadSdrId: session.user.id },
            select: { id: true },
        });
        const teamLeadMissionIds = teamLeadMissions.map((m) => m.id);

        const whereClause: {
            sdrId?: string;
            result: { in: string[] };
            campaign?: { missionId: string | { in: string[] } };
            OR?: Array<{ sdrId: string; campaign: { missionId: string | { in: string[] } } } | { campaign: { missionId: string | { in: string[] } } }>;
        } = {
            result: { in: Array.from(callbackStatusCodes) },
        };

        if (isBusinessDeveloper) {
            if (assignedMissionIds.length === 0) {
                return NextResponse.json({ success: true, count: 0, nextCallbackDate: null });
            }
            whereClause.campaign = { missionId: { in: assignedMissionIds } };
        } else if (!isBooker) {
            const missionFilter = { missionId: { in: [...new Set([...assignedMissionIds, ...teamLeadMissionIds])] } };
            const orParts: Array<{ sdrId: string; campaign: { missionId: string | { in: string[] } } } | { campaign: { missionId: string | { in: string[] } } }> = [
                { sdrId: session.user.id, campaign: missionFilter },
            ];
            if (teamLeadMissionIds.length > 0) {
                orParts.push({ campaign: { missionId: { in: teamLeadMissionIds } } });
            }
            whereClause.OR = orParts;
        }

        const count = await prisma.action.count({
            where: whereClause,
        });

        // Get next callback date
        const nextCallback = await prisma.action.findFirst({
            where: {
                ...whereClause,
                callbackDate: { gte: new Date() },
            },
            select: { callbackDate: true },
            orderBy: { callbackDate: 'asc' },
        });

        return NextResponse.json({
            success: true,
            count,
            nextCallbackDate: nextCallback?.callbackDate?.toISOString() ?? null,
        });

    } catch (error) {
        console.error("Error fetching callback count:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
