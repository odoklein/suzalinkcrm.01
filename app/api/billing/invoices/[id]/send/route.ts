import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { invoiceService } from "@/lib/billing/invoice-service";

// ============================================
// POST /api/billing/invoices/[id]/send - Mark invoice as sent
// ============================================

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(["MANAGER"], request);
    const { id } = await params;

    try {
        const invoice = await invoiceService.markAsSent(id, session.user.id);

        return successResponse(invoice);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                return errorResponse("Facture non trouvée", 404);
            }
            if (error.message.includes("validated before sending")) {
                return errorResponse("La facture doit être validée avant l'envoi", 400);
            }
        }
        throw error;
    }
});
