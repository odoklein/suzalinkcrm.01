import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { invoiceService } from "@/lib/billing/invoice-service";

// ============================================
// GET /api/billing/invoices/[id]/audit-log - Get invoice audit log
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;

    const auditLog = await invoiceService.getAuditLog(id);

    return successResponse(auditLog);
});
