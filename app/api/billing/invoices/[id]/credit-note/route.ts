import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { invoiceService } from "@/lib/billing/invoice-service";

// ============================================
// POST /api/billing/invoices/[id]/credit-note - Create credit note
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
        // No body is fine - will create full credit note
    }

    try {
        const creditNote = await invoiceService.createCreditNote(
            id,
            session.user.id,
            body.items || undefined
        );

        return successResponse(creditNote);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                return errorResponse("Facture non trouvée", 404);
            }
            if (error.message.includes("draft or cancelled")) {
                return errorResponse("Impossible de créer un avoir pour une facture brouillon ou annulée", 400);
            }
        }
        throw error;
    }
});
