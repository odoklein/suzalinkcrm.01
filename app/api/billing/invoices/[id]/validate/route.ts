import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { invoiceService } from "@/lib/billing/invoice-service";

// ============================================
// POST /api/billing/invoices/[id]/validate - Validate invoice
// ============================================

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(["MANAGER"], request);
    const { id } = await params;

    try {
        const invoice = await invoiceService.validateInvoice(id, session.user.id);

        return successResponse(invoice);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                return errorResponse("Facture non trouvée", 404);
            }
            if (error.message.includes("already validated")) {
                return errorResponse("La facture est déjà validée", 400);
            }
            if (error.message.includes("at least one item")) {
                return errorResponse("La facture doit contenir au moins un article", 400);
            }
        }
        throw error;
    }
});
