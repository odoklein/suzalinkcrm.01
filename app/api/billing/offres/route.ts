import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from "@/lib/api-utils";
import { OffreTarifStatut } from "@prisma/client";
import { z } from "zod";

// ============================================
// GET /api/billing/offres - List pricing templates
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const where: { statut?: OffreTarifStatut } = {};
    if (!includeArchived) {
        where.statut = "ACTIF";
    }

    const offres = await prisma.offreTarif.findMany({
        where,
        orderBy: { nom: "asc" },
        include: {
            _count: {
                select: {
                    engagements: {
                        where: { statut: "ACTIF" },
                    },
                },
            },
        },
    });

    const data = offres.map((o) => ({
        id: o.id,
        nom: o.nom,
        fixeMensuel: Number(o.fixeMensuel),
        prixParRdv: Number(o.prixParRdv),
        description: o.description,
        statut: o.statut,
        clientsActifs: o._count.engagements,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
    }));

    return successResponse(data);
});

// ============================================
// POST /api/billing/offres - Create pricing template
// ============================================

const createOffreSchema = z.object({
    nom: z.string().min(1, "Nom requis"),
    fixeMensuel: z.number().min(0, "Fixe mensuel doit être ≥ 0"),
    prixParRdv: z.number().min(0, "Prix par RDV doit être ≥ 0"),
    description: z.string().optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const body = await validateRequest(request, createOffreSchema);

    const offre = await prisma.offreTarif.create({
        data: {
            nom: body.nom,
            fixeMensuel: body.fixeMensuel,
            prixParRdv: body.prixParRdv,
            description: body.description ?? null,
        },
    });

    return successResponse(
        {
            id: offre.id,
            nom: offre.nom,
            fixeMensuel: Number(offre.fixeMensuel),
            prixParRdv: Number(offre.prixParRdv),
            description: offre.description,
            statut: offre.statut,
            createdAt: offre.createdAt,
            updatedAt: offre.updatedAt,
        },
        201
    );
});
