import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { paymentMatchingService } from "@/lib/billing/payment-matching-service";

// ============================================
// POST /api/billing/payments/[paymentId]/reject - Reject payment
// ============================================

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ paymentId: string }> }
) => {
    await requireRole(["MANAGER"], request);
    const { paymentId } = await params;

    try {
        await paymentMatchingService.rejectPayment(paymentId);

        return successResponse({ success: true });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                return errorResponse("Paiement non trouvé", 404);
            }
            if (error.message.includes("confirmed")) {
                return errorResponse("Impossible de rejeter un paiement confirmé", 400);
            }
        }
        throw error;
    }
});
