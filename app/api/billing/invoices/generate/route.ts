import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    ValidationError,
} from "@/lib/api-utils";
import { generateDraftFromEngagement, generateDraftsForPeriod } from "@/lib/billing/engagement-invoice-service";
import { z } from "zod";

const bodySchema = z.object({
    periodYear: z.number().int().min(2020).max(2100),
    periodMonth: z.number().int().min(1).max(12),
    clientId: z.string().optional(),
    engagementId: z.string().optional(),
});

// POST /api/billing/invoices/generate — Generate draft invoice(s) from engagement(s)
export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["MANAGER"], request);
    const body = await validateRequest(request, bodySchema);

    const userId = session.user.id!;
    const { periodYear, periodMonth, clientId, engagementId } = body;

    try {
        if (engagementId) {
            const result = await generateDraftFromEngagement(engagementId, periodYear, periodMonth, userId);
            return successResponse({ generated: 1, invoices: [result] }, 201);
        }

        const results = await generateDraftsForPeriod(periodYear, periodMonth, userId, {
            clientId: clientId ?? undefined,
            engagementId: undefined,
        });
        return successResponse({ generated: results.length, invoices: results }, 201);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors de la génération";
        return errorResponse(message, 400);
    }
});
