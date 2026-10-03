import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from "@/lib/api-utils";
import { z } from "zod";

// ============================================
// GET /api/billing/clients/[id] - Get billing client
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;

    const client = await prisma.billingClient.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    invoices: true,
                },
            },
        },
    });

    if (!client) {
        return errorResponse("Client non trouvé", 404);
    }

    return successResponse(client);
});

// ============================================
// PUT /api/billing/clients/[id] - Update billing client
// ============================================

const updateBillingClientSchema = z.object({
    legalName: z.string().min(1, "Nom légal requis").optional(),
    address: z.string().min(1, "Adresse requise").optional(),
    city: z.string().min(1, "Ville requise").optional(),
    postalCode: z.string().min(1, "Code postal requis").optional(),
    country: z.string().optional(),
    siret: z.string().optional(),
    vatNumber: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
});

export const PUT = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;
    const data = await validateRequest(request, updateBillingClientSchema);

    const existing = await prisma.billingClient.findUnique({
        where: { id },
    });

    if (!existing) {
        return errorResponse("Client non trouvé", 404);
    }

    const client = await prisma.billingClient.update({
        where: { id },
        data: {
            ...(data.legalName !== undefined && { legalName: data.legalName }),
            ...(data.address !== undefined && { address: data.address }),
            ...(data.city !== undefined && { city: data.city }),
            ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
            ...(data.country !== undefined && { country: data.country }),
            ...(data.siret !== undefined && { siret: data.siret || null }),
            ...(data.vatNumber !== undefined && { vatNumber: data.vatNumber || null }),
            ...(data.email !== undefined && { email: data.email || null }),
            ...(data.phone !== undefined && { phone: data.phone || null }),
        },
    });

    return successResponse(client);
});

// ============================================
// DELETE /api/billing/clients/[id] - Delete billing client
// ============================================

export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;

    const existing = await prisma.billingClient.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    invoices: true,
                },
            },
        },
    });

    if (!existing) {
        return errorResponse("Client non trouvé", 404);
    }

    // Check if client has invoices
    if (existing._count.invoices > 0) {
        return errorResponse(
            `Impossible de supprimer ce client car il a ${existing._count.invoices} facture(s) associée(s)`,
            400
        );
    }

    await prisma.billingClient.delete({
        where: { id },
    });

    return successResponse({ success: true });
});
