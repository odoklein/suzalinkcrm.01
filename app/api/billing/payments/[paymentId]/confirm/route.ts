import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { paymentMatchingService } from "@/lib/billing/payment-matching-service";

// ============================================
// POST /api/billing/payments/[paymentId]/confirm - Confirm payment
// ============================================

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ paymentId: string }> }
) => {
    const session = await requireRole(["MANAGER"], request);
    const { paymentId } = await params;

    try {
        const payment = await paymentMatchingService.confirmPayment(paymentId, session.user.id);

        return successResponse(payment);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                return errorResponse("Paiement non trouvé", 404);
            }
            if (error.message.includes("already confirmed")) {
                return errorResponse("Paiement déjà confirmé", 400);
            }
        }
        throw error;
    }
});
