import { NextRequest } from "next/server";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    ValidationError,
} from "@/lib/api-utils";
import { getRdvCountForClient } from "@/lib/billing/rdv-count-service";
import { startOfMonth, endOfMonth } from "date-fns";

// GET /api/billing/rdv-count?clientId=...&periodYear=2025&periodMonth=1
export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const periodYear = searchParams.get("periodYear");
    const periodMonth = searchParams.get("periodMonth");

    if (!clientId) throw new ValidationError("clientId requis");
    const year = periodYear ? parseInt(periodYear, 10) : new Date().getFullYear();
    const month = periodMonth ? parseInt(periodMonth, 10) : new Date().getMonth() + 1;
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        throw new ValidationError("periodYear et periodMonth invalides");
    }

    const periodStart = startOfMonth(new Date(year, month - 1));
    const periodEnd = endOfMonth(new Date(year, month - 1));

    const result = await getRdvCountForClient(clientId, periodStart, periodEnd);
    return successResponse(result);
});
