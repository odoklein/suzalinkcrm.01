// ============================================
// GET /api/support/manager/stats
// Rollup used by the manager sidebar support entry (unread badge + counts).
// ============================================

import { NextRequest } from "next/server";
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { getManagerInboxStats } from "@/lib/support/service";

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["MANAGER"], request);
    const stats = await getManagerInboxStats(session.user.id);
    return successResponse(stats);
});
