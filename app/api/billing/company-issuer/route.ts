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
// GET /api/billing/company-issuer - Get company issuer
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);

    // Get the first (and only) company issuer
    const issuer = await prisma.companyIssuer.findFirst();

    if (!issuer) {
        return errorResponse("Émetteur non configuré", 404);
    }

    return successResponse(issuer);
});

// ============================================
// PUT /api/billing/company-issuer - Update company issuer
// ============================================

const updateIssuerSchema = z.object({
    legalName: z.string().min(1, "Nom légal requis"),
    address: z.string().min(1, "Adresse requise"),
    city: z.string().min(1, "Ville requise"),
    postalCode: z.string().min(1, "Code postal requis"),
    country: z.string().default("France"),
    siret: z.string().min(1, "SIRET requis"),
    vatNumber: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    logo: z.string().optional(),
    // New EU 2026 compliance fields
    legalForm: z.string().optional(),
    capitalSocial: z.string().optional(),
    rcsCity: z.string().optional(),
    rcsNumber: z.string().optional(),
    iban: z.string().optional(),
    bic: z.string().optional(),
    defaultPaymentTermsDays: z.number().int().min(0).max(365).optional(),
    defaultLatePenaltyRate: z.number().min(0).max(100).optional(),
    defaultEarlyPaymentDiscount: z.string().optional(),
});

export const PUT = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const data = await validateRequest(request, updateIssuerSchema);

    // Get existing issuer or create if doesn't exist
    const existing = await prisma.companyIssuer.findFirst();

    const issuerData = {
        legalName: data.legalName,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country,
        siret: data.siret,
        vatNumber: data.vatNumber || null,
        email: data.email || null,
        phone: data.phone || null,
        logo: data.logo || null,
        // New fields
        legalForm: data.legalForm || null,
        capitalSocial: data.capitalSocial || null,
        rcsCity: data.rcsCity || null,
        rcsNumber: data.rcsNumber || null,
        iban: data.iban || null,
        bic: data.bic || null,
        defaultPaymentTermsDays: data.defaultPaymentTermsDays ?? 30,
        defaultLatePenaltyRate: data.defaultLatePenaltyRate ?? 0,
        defaultEarlyPaymentDiscount: data.defaultEarlyPaymentDiscount || null,
    };

    const issuer = existing
        ? await prisma.companyIssuer.update({
              where: { id: existing.id },
              data: issuerData,
          })
        : await prisma.companyIssuer.create({
              data: issuerData,
          });

    return successResponse(issuer);
});
