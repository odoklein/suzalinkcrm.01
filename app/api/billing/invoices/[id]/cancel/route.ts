import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { invoiceService } from "@/lib/billing/invoice-service";

// ============================================
// POST /api/billing/invoices/[id]/cancel - Cancel invoice
// ============================================

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(["MANAGER"], request);
    const { id } = await params;

    let body: any = {};
    try {
        body = await request.json();
    } catch {
        // No body is fine
    }

    try {
        const invoice = await invoiceService.cancelInvoice(
            id,
            session.user.id,
            body.reason || undefined
        );

        return successResponse(invoice);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                return errorResponse("Facture non trouvée", 404);
            }
            if (error.message.includes("paid invoice")) {
                return errorResponse("Impossible d'annuler une facture payée. Créez un avoir à la place.", 400);
            }
            if (error.message.includes("already cancelled")) {
                return errorResponse("La facture est déjà annulée", 400);
            }
        }
        throw error;
    }
});
