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
// GET /api/billing/clients - List billing clients
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const where: any = {};
    if (search) {
        where.OR = [
            { legalName: { contains: search, mode: "insensitive" } },
            { siret: { contains: search, mode: "insensitive" } },
            { vatNumber: { contains: search, mode: "insensitive" } },
        ];
    }

    const clients = await prisma.billingClient.findMany({
        where,
        orderBy: { legalName: "asc" },
        take: 50,
    });

    return successResponse(clients);
});

// ============================================
// POST /api/billing/clients - Create billing client
// ============================================

const createBillingClientSchema = z.object({
    legalName: z.string().min(1, "Nom légal requis"),
    address: z.string().min(1, "Adresse requise"),
    city: z.string().min(1, "Ville requise"),
    postalCode: z.string().min(1, "Code postal requis"),
    country: z.string().default("France"),
    siret: z.string().optional(),
    vatNumber: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const data = await validateRequest(request, createBillingClientSchema);

    const client = await prisma.billingClient.create({
        data: {
            legalName: data.legalName,
            address: data.address,
            city: data.city,
            postalCode: data.postalCode,
            country: data.country,
            siret: data.siret || null,
            vatNumber: data.vatNumber || null,
            email: data.email || null,
            phone: data.phone || null,
        },
    });

    return successResponse(client, 201);
});
