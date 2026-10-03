// ============================================
// GET /api/support/manager/conversations
// Lists every support conversation (broadcast visibility for all active managers).
// ============================================

import { NextRequest } from "next/server";
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { listManagerInbox } from "@/lib/support/service";
import type { SupportConversationStatus } from "@prisma/client";

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["MANAGER"], request);
    const { searchParams } = new URL(request.url);

    const statusRaw = searchParams.get("status");
    const status: SupportConversationStatus | undefined =
        statusRaw === "ACTIVE" || statusRaw === "RESOLVED" ? statusRaw : undefined;

    const conversations = await listManagerInbox(session.user.id, {
        status,
        unreadOnly: searchParams.get("unreadOnly") === "true",
        search: searchParams.get("search") || undefined,
    });
    return successResponse(conversations);
});
