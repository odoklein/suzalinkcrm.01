import { NextRequest } from "next/server";
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { reminderService } from "@/lib/billing/reminder-service";

// ============================================
// GET /api/billing/stats - Get billing statistics
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type") || "overview";

    switch (type) {
        case "aging": {
            const aging = await reminderService.getAgingReport();
            return successResponse(aging);
        }

        case "dso": {
            const dso = await reminderService.calculateDSO();
            return successResponse({ dso });
        }

        case "monthly-revenue": {
            const months = parseInt(searchParams.get("months") || "12");
            const revenue = await reminderService.getMonthlyRevenue(months);
            return successResponse(revenue);
        }

        case "vat-summary": {
            const startDate = searchParams.get("startDate");
            const endDate = searchParams.get("endDate");
            const now = new Date();
            const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
            const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            const summary = await reminderService.getVatSummary(start, end);
            return successResponse(summary);
        }

        case "overdue": {
            const overdue = await reminderService.getOverdueInvoices();
            return successResponse(overdue);
        }

        default: {
            // Return all stats
            const [aging, dso, revenue, overdue] = await Promise.all([
                reminderService.getAgingReport(),
                reminderService.calculateDSO(),
                reminderService.getMonthlyRevenue(12),
                reminderService.getOverdueInvoices(),
            ]);

            return successResponse({
                aging,
                dso,
                monthlyRevenue: revenue,
                overdueInvoices: overdue,
            });
        }
    }
});
