import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from "@/lib/api-utils";
import { invoiceService, UpdateInvoiceData } from "@/lib/billing/invoice-service";
import { z } from "zod";

// ============================================
// GET /api/billing/invoices/[id] - Get invoice
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;

    const invoice = await invoiceService.getInvoice(id);

    if (!invoice) {
        return errorResponse("Facture non trouvée", 404);
    }

    return successResponse(invoice);
});

// ============================================
// PUT /api/billing/invoices/[id] - Update invoice
// ============================================

const updateInvoiceSchema = z.object({
    billingClientId: z.string().min(1).optional(),
    issueDate: z.string().transform((str) => new Date(str)).optional(),
    dueDate: z.string().transform((str) => new Date(str)).optional(),
    items: z
        .array(
            z.object({
                description: z.string().min(1),
                quantity: z.number().positive(),
                unitPriceHt: z.number().nonnegative(),
                vatRate: z.number().min(0).max(100),
            })
        )
        .min(1)
        .optional(),
});

export const PUT = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(["MANAGER"], request);
    const { id } = await params;
    const data = await validateRequest(request, updateInvoiceSchema);

    try {
        const updateData: UpdateInvoiceData = {
            ...(data.billingClientId && { billingClientId: data.billingClientId }),
            ...(data.issueDate && { issueDate: data.issueDate }),
            ...(data.dueDate && { dueDate: data.dueDate }),
            ...(data.items && { items: data.items }),
        };

        const invoice = await invoiceService.updateInvoice(id, updateData, session.user.id);

        return successResponse(invoice);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                return errorResponse("Facture non trouvée", 404);
            }
            if (error.message.includes("DRAFT")) {
                return errorResponse("Impossible de modifier une facture qui n'est pas en brouillon", 400);
            }
        }
        throw error;
    }
});
