import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    getPaginationParams,
    paginatedResponse,
} from "@/lib/api-utils";
import { invoiceService } from "@/lib/billing/invoice-service";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";

// ============================================
// GET /api/billing/invoices - List invoices
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);

    const status = searchParams.get("status") as InvoiceStatus | null;
    const billingClientId = searchParams.get("billingClientId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");

    const filters = {
        ...(status && { status }),
        ...(billingClientId && { billingClientId }),
        ...(dateFrom && { dateFrom: new Date(dateFrom) }),
        ...(dateTo && { dateTo: new Date(dateTo) }),
        ...(search && { search }),
    };

    const result = await invoiceService.listInvoices(filters, { page, limit });

    return paginatedResponse(result.invoices, result.total, result.page, result.limit);
});

// ============================================
// POST /api/billing/invoices - Create invoice
// ============================================

const createInvoiceSchema = z.object({
    billingClientId: z.string().min(1, "Client requis"),
    companyIssuerId: z.string().min(1, "Émetteur requis"),
    issueDate: z.string().transform((str) => new Date(str)),
    dueDate: z.string().transform((str) => new Date(str)),
    paymentTermsDays: z.number().int().min(0).max(365).optional(),
    paymentTermsText: z.string().optional(),
    latePenaltyRate: z.number().min(0).max(100).optional(),
    earlyPaymentDiscount: z.string().optional(),
    notes: z.string().optional(),
    currency: z.string().optional(),
    items: z
        .array(
            z.object({
                description: z.string().min(1, "Description requise"),
                quantity: z.number().positive("Quantité doit être positive"),
                unitPriceHt: z.number().nonnegative("Prix unitaire doit être positif"),
                vatRate: z.number().min(0).max(100, "TVA doit être entre 0 et 100"),
            })
        )
        .min(1, "Au moins un article requis"),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["MANAGER"], request);
    const data = await validateRequest(request, createInvoiceSchema);

    // Verify billing client exists
    const billingClient = await prisma.billingClient.findUnique({
        where: { id: data.billingClientId },
    });

    if (!billingClient) {
        return errorResponse("Client de facturation non trouvé", 404);
    }

    // Verify company issuer exists
    const companyIssuer = await prisma.companyIssuer.findUnique({
        where: { id: data.companyIssuerId },
    });

    if (!companyIssuer) {
        return errorResponse("Émetteur non trouvé", 404);
    }

    const invoice = await invoiceService.createInvoice(data, session.user.id);

    return successResponse(invoice, 201);
});
