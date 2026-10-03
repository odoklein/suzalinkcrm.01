import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    NotFoundError,
    ValidationError,
} from "@/lib/api-utils";
import { addMonths, endOfMonth } from "date-fns";
import { z } from "zod";
import { EngagementStatut } from "@prisma/client";

// ============================================
// GET /api/billing/engagements/[id]
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;

    const engagement = await prisma.engagement.findUnique({
        where: { id },
        include: {
            client: { select: { id: true, name: true, email: true } },
            offreTarif: {
                select: {
                    id: true,
                    nom: true,
                    fixeMensuel: true,
                    prixParRdv: true,
                    description: true,
                },
            },
        },
    });

    if (!engagement) throw new NotFoundError("Engagement introuvable");

    return successResponse({
        id: engagement.id,
        clientId: engagement.clientId,
        client: engagement.client,
        offreTarifId: engagement.offreTarifId,
        offreTarif: {
            ...engagement.offreTarif,
            fixeMensuel: Number(engagement.offreTarif.fixeMensuel),
            prixParRdv: Number(engagement.offreTarif.prixParRdv),
        },
        fixeOverride: engagement.fixeOverride != null ? Number(engagement.fixeOverride) : null,
        rdvOverride: engagement.rdvOverride != null ? Number(engagement.rdvOverride) : null,
        dureeMois: engagement.dureeMois,
        debut: engagement.debut,
        fin: engagement.fin,
        statut: engagement.statut,
        penaliteResiliation: engagement.penaliteResiliation,
        renouvellement: engagement.renouvellement,
        createdAt: engagement.createdAt,
        updatedAt: engagement.updatedAt,
    });
});

// ============================================
// PATCH /api/billing/engagements/[id] - Update, Activer, Renouveler, Résilier
// ============================================

const updateEngagementSchema = z.object({
    fixeOverride: z.number().min(0).optional().nullable(),
    rdvOverride: z.number().min(0).optional().nullable(),
    penaliteResiliation: z.string().optional().nullable(),
    renouvellement: z.string().optional().nullable(),
    statut: z.enum(["BROUILLON", "ACTIF", "EXPIRE", "RENOUVELE", "RESILIE", "ARCHIVE"]).optional(),
    // For renew: new term
    nouveauDebut: z.string().transform((s) => new Date(s)).optional(),
    nouvelleDureeMois: z.number().int().min(1).max(120).optional(),
});

export const PATCH = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;

    const engagement = await prisma.engagement.findUnique({
        where: { id },
        include: { offreTarif: true },
    });

    if (!engagement) throw new NotFoundError("Engagement introuvable");

    const body = await validateRequest(request, updateEngagementSchema);

    const data: Parameters<typeof prisma.engagement.update>[0]["data"] = {};
    if (body.fixeOverride !== undefined) data.fixeOverride = body.fixeOverride;
    if (body.rdvOverride !== undefined) data.rdvOverride = body.rdvOverride;
    if (body.penaliteResiliation !== undefined) data.penaliteResiliation = body.penaliteResiliation;
    if (body.renouvellement !== undefined) data.renouvellement = body.renouvellement;
    if (body.statut !== undefined) data.statut = body.statut as EngagementStatut;

    if (body.nouveauDebut !== undefined && body.nouvelleDureeMois !== undefined) {
        data.debut = body.nouveauDebut;
        data.fin = endOfMonth(addMonths(body.nouveauDebut, body.nouvelleDureeMois));
        data.dureeMois = body.nouvelleDureeMois;
        data.statut = "ACTIF";
    }

    const updated = await prisma.engagement.update({
        where: { id },
        data,
        include: {
            client: { select: { id: true, name: true } },
            offreTarif: {
                select: {
                    id: true,
                    nom: true,
                    fixeMensuel: true,
                    prixParRdv: true,
                },
            },
        },
    });

    return successResponse({
        id: updated.id,
        clientId: updated.clientId,
        clientName: updated.client.name,
        offreTarifId: updated.offreTarifId,
        offreName: updated.offreTarif.nom,
        fixeOverride: updated.fixeOverride != null ? Number(updated.fixeOverride) : null,
        rdvOverride: updated.rdvOverride != null ? Number(updated.rdvOverride) : null,
        dureeMois: updated.dureeMois,
        debut: updated.debut,
        fin: updated.fin,
        statut: updated.statut,
        penaliteResiliation: updated.penaliteResiliation,
        renouvellement: updated.renouvellement,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
    });
});
