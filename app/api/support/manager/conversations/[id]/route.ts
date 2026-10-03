// ============================================
// GET /api/support/manager/conversations/[id]
// Manager loads a single support conversation detail (messages + metadata).
// ============================================

import { NextRequest } from "next/server";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
} from "@/lib/api-utils";
import { getConversationForManager } from "@/lib/support/service";

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) => {
    const session = await requireRole(["MANAGER"], request);
    const { id } = await params;
    const conversation = await getConversationForManager(id, session.user.id);
    if (!conversation) throw new NotFoundError("Conversation introuvable");
    return successResponse(conversation);
});
