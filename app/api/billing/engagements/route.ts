import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    ValidationError,
} from "@/lib/api-utils";
import { addMonths, endOfMonth } from "date-fns";
import { z } from "zod";
import type { EngagementStatut, Prisma } from "@prisma/client";

// ============================================
// GET /api/billing/engagements - List engagements
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const statut = searchParams.get("statut");

    const where: { clientId?: string; statut?: EngagementStatut } = {};
    if (clientId) where.clientId = clientId;
    if (statut) where.statut = statut as EngagementStatut;

    const engagements = await prisma.engagement.findMany({
        where,
        orderBy: { debut: "desc" },
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

    type EngagementWithRelations = Prisma.EngagementGetPayload<{
        include: { client: { select: { id: true; name: true } }; offreTarif: { select: { id: true; nom: true; fixeMensuel: true; prixParRdv: true } } };
    }>;
    const data = (engagements as EngagementWithRelations[]).map((e) => ({
        id: e.id,
        clientId: e.clientId,
        clientName: e.client.name,
        offreTarifId: e.offreTarifId,
        offreName: e.offreTarif.nom,
        fixeMensuel: Number(e.offreTarif.fixeMensuel),
        prixParRdv: Number(e.offreTarif.prixParRdv),
        fixeOverride: e.fixeOverride != null ? Number(e.fixeOverride) : null,
        rdvOverride: e.rdvOverride != null ? Number(e.rdvOverride) : null,
        dureeMois: e.dureeMois,
        debut: e.debut,
        fin: e.fin,
        statut: e.statut,
        penaliteResiliation: e.penaliteResiliation,
        renouvellement: e.renouvellement,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
    }));

    return successResponse(data);
});

// ============================================
// POST /api/billing/engagements - Create engagement
// ============================================

const createEngagementSchema = z.object({
    clientId: z.string().min(1, "Client requis"),
    offreTarifId: z.string().min(1, "Offre requise"),
    fixeOverride: z.number().min(0).optional().nullable(),
    rdvOverride: z.number().min(0).optional().nullable(),
    dureeMois: z.number().int().min(1).max(120),
    debut: z.string().transform((s) => new Date(s)),
    penaliteResiliation: z.string().optional().nullable(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const body = await validateRequest(request, createEngagementSchema);

    const client = await prisma.client.findUnique({ where: { id: body.clientId } });
    if (!client) throw new ValidationError("Client introuvable");

    const offre = await prisma.offreTarif.findUnique({ where: { id: body.offreTarifId } });
    if (!offre) throw new ValidationError("Offre introuvable");
    if (offre.statut === "ARCHIVE") throw new ValidationError("Impossible d'utiliser une offre archivée");

    const fin = endOfMonth(addMonths(body.debut, body.dureeMois));

    const engagement = await prisma.engagement.create({
        data: {
            clientId: body.clientId,
            offreTarifId: body.offreTarifId,
            fixeOverride: body.fixeOverride ?? null,
            rdvOverride: body.rdvOverride ?? null,
            dureeMois: body.dureeMois,
            debut: body.debut,
            fin,
            statut: "BROUILLON",
            penaliteResiliation: body.penaliteResiliation ?? null,
        },
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

    return successResponse(
        {
            id: engagement.id,
            clientId: engagement.clientId,
            clientName: engagement.client.name,
            offreTarifId: engagement.offreTarifId,
            offreName: engagement.offreTarif.nom,
            fixeMensuel: Number(engagement.offreTarif.fixeMensuel),
            prixParRdv: Number(engagement.offreTarif.prixParRdv),
            fixeOverride: engagement.fixeOverride != null ? Number(engagement.fixeOverride) : null,
            rdvOverride: engagement.rdvOverride != null ? Number(engagement.rdvOverride) : null,
            dureeMois: engagement.dureeMois,
            debut: engagement.debut,
            fin: engagement.fin,
            statut: engagement.statut,
            penaliteResiliation: engagement.penaliteResiliation,
            createdAt: engagement.createdAt,
            updatedAt: engagement.updatedAt,
        },
        201
    );
});
