// ============================================
// POST /api/support/manager/conversations/[id]/resolve
// DELETE (reopen alias): manager reopens a resolved conversation.
// ============================================

import { NextRequest } from "next/server";
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import {
    resolveConversation,
    reopenConversation,
} from "@/lib/support/service";

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) => {
    const session = await requireRole(["MANAGER"], request);
    const { id } = await params;
    await resolveConversation(
        id,
        session.user.id,
        session.user.name ?? "Un manager",
    );
    return successResponse({ ok: true });
});

export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) => {
    const session = await requireRole(["MANAGER"], request);
    const { id } = await params;
    await reopenConversation(
        id,
        session.user.id,
        session.user.name ?? "Un manager",
        "MANAGER",
    );
    return successResponse({ ok: true });
});
