import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    NotFoundError,
} from "@/lib/api-utils";
import { OffreTarifStatut } from "@prisma/client";
import { z } from "zod";

// ============================================
// GET /api/billing/offres/[id] - Get one offer
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;

    const offre = await prisma.offreTarif.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    engagements: { where: { statut: "ACTIF" } },
                },
            },
        },
    });

    if (!offre) {
        throw new NotFoundError("Offre introuvable");
    }

    return successResponse({
        id: offre.id,
        nom: offre.nom,
        fixeMensuel: Number(offre.fixeMensuel),
        prixParRdv: Number(offre.prixParRdv),
        description: offre.description,
        statut: offre.statut,
        clientsActifs: offre._count.engagements,
        createdAt: offre.createdAt,
        updatedAt: offre.updatedAt,
    });
});

// ============================================
// PATCH /api/billing/offres/[id] - Update or archive
// ============================================

const updateOffreSchema = z.object({
    nom: z.string().min(1).optional(),
    fixeMensuel: z.number().min(0).optional(),
    prixParRdv: z.number().min(0).optional(),
    description: z.string().optional().nullable(),
    statut: z.enum(["ACTIF", "ARCHIVE"]).optional(),
});

export const PATCH = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;

    const existing = await prisma.offreTarif.findUnique({ where: { id } });
    if (!existing) {
        throw new NotFoundError("Offre introuvable");
    }

    const body = await validateRequest(request, updateOffreSchema);

    const data: Parameters<typeof prisma.offreTarif.update>[0]["data"] = {};
    if (body.nom !== undefined) data.nom = body.nom;
    if (body.fixeMensuel !== undefined) data.fixeMensuel = body.fixeMensuel;
    if (body.prixParRdv !== undefined) data.prixParRdv = body.prixParRdv;
    if (body.description !== undefined) data.description = body.description;
    if (body.statut !== undefined) data.statut = body.statut as OffreTarifStatut;

    const offre = await prisma.offreTarif.update({
        where: { id },
        data,
    });

    return successResponse({
        id: offre.id,
        nom: offre.nom,
        fixeMensuel: Number(offre.fixeMensuel),
        prixParRdv: Number(offre.prixParRdv),
        description: offre.description,
        statut: offre.statut,
        createdAt: offre.createdAt,
        updatedAt: offre.updatedAt,
    });
});
