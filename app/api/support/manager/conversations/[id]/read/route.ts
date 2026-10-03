// ============================================
// POST /api/support/manager/conversations/[id]/read
// Manager marks a support conversation as read.
// ============================================

import { NextRequest } from "next/server";
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { markRead } from "@/lib/support/service";

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) => {
    const session = await requireRole(["MANAGER"], request);
    const { id } = await params;
    await markRead(id, session.user.id, "MANAGER");
    return successResponse({ ok: true });
});
