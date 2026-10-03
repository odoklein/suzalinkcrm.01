// ============================================
// POST /api/support/manager/conversations/[id]/pin
// Manager pins/unpins a support conversation in their own workspace view.
// ============================================

import { NextRequest } from "next/server";
import { z } from "zod";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from "@/lib/api-utils";
import { togglePin } from "@/lib/support/service";

const PostBody = z.object({ pinned: z.boolean() });

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) => {
    const session = await requireRole(["MANAGER"], request);
    const { id } = await params;
    const body = await validateRequest(request, PostBody);
    await togglePin(id, session.user.id, body.pinned);
    return successResponse({ ok: true });
});
