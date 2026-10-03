import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    errorResponse,
    requireRole,
    successResponse,
    withErrorHandler,
} from "@/lib/api-utils";
import { enrichActionShouldUseForce } from "@/lib/call-enrichment/enrich-action";
import { enrichCallActionsParallel } from "@/lib/call-enrichment/enrich-sync-parallel";

const TZ = process.env.CALL_ENRICHMENT_DAY_TZ ?? "Europe/Paris";
const MAX_RANGE_DAYS = 120;
const MAX_ACTIONS_FETCH = 500;
/** Limite quand on agrège toutes les missions actives avec canal appel */
const MAX_ACTIONS_FETCH_ALL = 2000;
// Réduit de 200 → 50 pour éviter les rafales : 50 × 5 lignes × 15 pages = ~375 req max au lieu de 3 000.
const MAX_ACTIONS_SYNC = 50;

function missionSupportsCallChannel(m: {
    channel: string;
    channels: string[];
}): boolean {
    if (m.channels?.length) return m.channels.includes("CALL");
    return m.channel === "CALL";
}

function parseDateRange(from: string, to: string): { gte: Date; lte: Date } | null {
    const fromDt = DateTime.fromISO(from.trim(), { zone: TZ });
    const toDt = DateTime.fromISO(to.trim(), { zone: TZ });
    if (!fromDt.isValid || !toDt.isValid) return null;
    if (fromDt > toDt) return null;
    const days = toDt.diff(fromDt, "days").days;
    if (days > MAX_RANGE_DAYS) return null;
    return {
        gte: fromDt.startOf("day").toUTC().toJSDate(),
        lte: toDt.endOf("day").toUTC().toJSDate(),
    };
}

function contactLine(
    contact: { firstName?: string | null; lastName?: string | null } | null,
): string {
    if (!contact) return "—";
    const n = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
    return n || "—";
}

function companyLine(
    company: { name: string } | null,
    contact: { company: { name: string } | null } | null,
): string {
    return company?.name?.trim() || contact?.company?.name?.trim() || "—";
}

/** Numéros utilisés pour la correspondance Allo (affichage manager). */
function phonesForMatchLine(a: {
    meetingPhone: string | null;
    contact: { phone: string | null } | null;
    company: { phone: string | null } | null;
}): string {
    const parts = [a.meetingPhone, a.contact?.phone, a.company?.phone]
        .map((p) => p?.trim())
        .filter((p): p is string => !!p);
    return [...new Set(parts)].join(" · ") || "—";
}

const actionQueueSelect = {
    id: true,
    createdAt: true,
    result: true,
    duration: true,
    note: true,
    meetingPhone: true,
    callSummary: true,
    callTranscription: true,
    callRecordingUrl: true,
    callEnrichmentAt: true,
    callEnrichmentError: true,
    sdr: { select: { id: true, name: true } },
    campaign: {
        select: {
            id: true,
            name: true,
            mission: { select: { id: true, name: true } },
        },
    },
    contact: {
        select: {
            firstName: true,
            lastName: true,
            phone: true,
            company: { select: { name: true } },
        },
    },
    company: { select: { name: true, phone: true } },
} as const;

// GET — list CALL actions in mission + range with résumé / enregistrement manquants
//       ou ?allCallMissions=1 — toutes les missions actives avec canal CALL
export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get("missionId")?.trim();
    const allCallMissions = searchParams.get("allCallMissions") === "1";
    const from = searchParams.get("from")?.trim() ?? "";
    const to = searchParams.get("to")?.trim() ?? "";

    if (!missionId && !allCallMissions) {
        return errorResponse("missionId requis, ou allCallMissions=1", 400);
    }
    if (missionId && allCallMissions) {
        return errorResponse("Utilisez soit missionId, soit allCallMissions=1", 400);
    }

    const range = parseDateRange(from, to);
    if (!range) {
        return errorResponse(
            `Plage de dates invalide (max ${MAX_RANGE_DAYS} jours, format AAAA-MM-JJ)`,
            400,
        );
    }

    let rows: Array<{
        id: string;
        createdAt: Date;
        result: string;
        duration: number | null;
        note: string | null;
        meetingPhone: string | null;
        callSummary: string | null;
        callTranscription: string | null;
        callRecordingUrl: string | null;
        callEnrichmentAt: Date | null;
        callEnrichmentError: string | null;
        sdr: { id: string; name: string } | null;
        campaign: {
            id: string;
            name: string;
            mission: { id: string; name: string } | null;
        };
        contact: {
            firstName: string | null;
            lastName: string | null;
            phone: string | null;
            company: { name: string } | null;
        } | null;
        company: { name: string; phone: string | null } | null;
    }>;
    let callMissionCount: number | undefined;

    if (missionId) {
        const mission = await prisma.mission.findUnique({
            where: { id: missionId },
            select: { id: true },
        });
        if (!mission) {
            return errorResponse("Mission introuvable", 404);
        }

        rows = await prisma.action.findMany({
            where: {
                channel: "CALL",
                campaign: { missionId },
                createdAt: { gte: range.gte, lte: range.lte },
            },
            select: actionQueueSelect,
            orderBy: { createdAt: "desc" },
            take: MAX_ACTIONS_FETCH,
        });
    } else {
        const callMissions = await prisma.mission.findMany({
            where: {
                isActive: true,
                OR: [{ channels: { has: "CALL" } }, { channel: "CALL" }],
            },
            select: { id: true },
        });
        const ids = callMissions.map((m) => m.id);
        callMissionCount = ids.length;
        if (ids.length === 0) {
            return successResponse({
                from,
                to,
                scanned: 0,
                incompleteCount: 0,
                items: [],
                allCallMissions: true,
                callMissionCount: 0,
            });
        }

        rows = await prisma.action.findMany({
            where: {
                channel: "CALL",
                campaign: { missionId: { in: ids } },
                createdAt: { gte: range.gte, lte: range.lte },
            },
            select: actionQueueSelect,
            orderBy: { createdAt: "desc" },
            take: MAX_ACTIONS_FETCH_ALL,
        });
    }

    const incomplete = rows.filter(
        (a) => !a.callSummary?.trim() || !a.callRecordingUrl?.trim(),
    );

    const items = incomplete.map((a) => {
        const hasSummary = !!a.callSummary?.trim();
        const hasRecording = !!a.callRecordingUrl?.trim();
        const hasTranscription = !!a.callTranscription?.trim();
        const summaryFull = a.callSummary?.trim() ?? "";
        const transcriptionFull = a.callTranscription?.trim() ?? "";
        return {
            id: a.id,
            createdAt: a.createdAt.toISOString(),
            result: a.result,
            durationSec: a.duration ?? null,
            missionName: a.campaign?.mission?.name ?? "—",
            campaignName: a.campaign?.name ?? "—",
            contactLine: contactLine(a.contact),
            companyLine: companyLine(a.company, a.contact),
            phonesForMatch: phonesForMatchLine(a),
            sdrName: a.sdr?.name ?? "—",
            note: a.note?.trim() || null,
            hasSummary,
            hasRecording,
            hasTranscription,
            callSummary: summaryFull || null,
            callTranscription: transcriptionFull || null,
            callSummaryPreview:
                summaryFull.length > 200 ? `${summaryFull.slice(0, 200)}…` : summaryFull || null,
            callTranscriptionPreview:
                transcriptionFull.length > 160
                    ? `${transcriptionFull.slice(0, 160)}…`
                    : transcriptionFull || null,
            callEnrichmentAt: a.callEnrichmentAt?.toISOString() ?? null,
            callEnrichmentError: a.callEnrichmentError,
            willUseForce: enrichActionShouldUseForce(a),
        };
    });

    return successResponse({
        from,
        to,
        scanned: rows.length,
        incompleteCount: items.length,
        items,
        ...(allCallMissions
            ? { allCallMissions: true as const, callMissionCount }
            : { allCallMissions: false as const }),
    });
});

const postSchema = z.object({
    missionId: z.string().min(1).optional(),
    actionIds: z
        .array(z.string().min(1))
        .min(1)
        .max(MAX_ACTIONS_SYNC),
});

// POST — sync sélection (Allo) pour des actions ; missionId optionnel (sinon toute mission active CALL)
export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Données invalides (actionIds, missionId optionnel)", 400);
    }
    const { missionId, actionIds } = parsed.data;

    const uniqueIds = [...new Set(actionIds)];

    let actions: Array<{
        id: string;
        callEnrichmentAt: Date | null;
        callSummary: string | null;
        callRecordingUrl: string | null;
    }>;

    if (missionId) {
        const mission = await prisma.mission.findUnique({
            where: { id: missionId },
            select: { id: true },
        });
        if (!mission) {
            return errorResponse("Mission introuvable", 404);
        }

        const found = await prisma.action.findMany({
            where: {
                id: { in: uniqueIds },
                channel: "CALL",
                campaign: { missionId },
            },
            select: {
                id: true,
                callEnrichmentAt: true,
                callSummary: true,
                callRecordingUrl: true,
            },
        });

        if (found.length !== uniqueIds.length) {
            return errorResponse(
                "Certaines actions sont introuvables ou n’appartiennent pas à cette mission",
                400,
            );
        }
        actions = found;
    } else {
        const found = await prisma.action.findMany({
            where: {
                id: { in: uniqueIds },
                channel: "CALL",
            },
            select: {
                id: true,
                callEnrichmentAt: true,
                callSummary: true,
                callRecordingUrl: true,
                campaign: {
                    select: {
                        mission: {
                            select: {
                                isActive: true,
                                channel: true,
                                channels: true,
                            },
                        },
                    },
                },
            },
        });

        if (found.length !== uniqueIds.length) {
            return errorResponse(
                "Certaines actions sont introuvables ou ne sont pas des appels",
                400,
            );
        }

        for (const a of found) {
            const m = a.campaign.mission;
            if (!m || !m.isActive || !missionSupportsCallChannel(m)) {
                return errorResponse(
                    "Certaines actions n’appartiennent pas à une mission active avec canal appel",
                    400,
                );
            }
        }

        actions = found.map(({ campaign: _c, ...rest }) => rest);
    }

    const results = await enrichCallActionsParallel(actions, "[manager-call-enrichment]");

    const enriched = results.filter((r) => r.status === "enriched").length;
    const noMatch = results.filter((r) => r.status === "no_match").length;
    const noPhone = results.filter((r) => r.status === "no_phone").length;
    const errors = results.filter((r) => r.status === "error").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return successResponse({
        total: results.length,
        enriched,
        noMatch,
        noPhone,
        errors,
        skipped,
        results,
    });
});
