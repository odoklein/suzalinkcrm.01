import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { paymentMatchingService } from "@/lib/billing/payment-matching-service";

// ============================================
// POST /api/billing/payments/sync - Sync Qonto payments
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const { searchParams } = new URL(request.url);
    const sinceDate = searchParams.get("sinceDate") || undefined;

    try {
        const result = await paymentMatchingService.syncQontoPayments(sinceDate);

        return successResponse({
            matched: result.matched,
            errors: result.errors,
            message: `${result.matched} paiement(s) détecté(s)`,
        });
    } catch (error) {
        console.error("Payment sync error:", error);
        if (error instanceof Error && error.message.includes("QONTO")) {
            return errorResponse("Service Qonto non configuré", 503);
        }
        throw error;
    }
});
