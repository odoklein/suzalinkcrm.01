import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { pappersService, PappersService } from "@/lib/billing/pappers-service";

// ============================================
// GET /api/billing/clients/search - Search companies via Pappers
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
        return errorResponse("Requête de recherche requise (min 2 caractères)", 400);
    }

    try {
        const results = await pappersService.searchCompany(query);

        // Convert to BillingClient format
        const clients = results.map((company) => PappersService.toBillingClient(company));

        return successResponse(clients);
    } catch (error: unknown) {
        console.error("Pappers search error:", error);
        const e = error as Error & { isQuotaError?: boolean; statusCode?: number };
        if (e instanceof Error) {
            // Check for API key configuration error
            if (e.message.includes("PAPPERS_API_KEY")) {
                return errorResponse("Service Pappers non configuré", 503);
            }
            // Check for quota/credit errors (401)
            if (e.isQuotaError || e.statusCode === 401) {
                return errorResponse(
                    "Quota Pappers épuisé. Veuillez recharger vos crédits ou utiliser la saisie manuelle.",
                    402
                );
            }
            if (e.message) {
                return errorResponse(e.message, e.statusCode ?? 500);
            }
        }
        return errorResponse("Erreur lors de la recherche", 500);
    }
});
