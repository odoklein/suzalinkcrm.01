import { NextRequest } from "next/server";
import {
    requireRole,
    successResponse,
    errorResponse,
    withErrorHandler,
} from "@/lib/api-utils";
import { getAuthEvents, logAuthEventView } from "@/lib/auth-event";
import { prisma } from "@/lib/prisma";
import type { AuthOutcome } from "@prisma/client";

// Only MANAGER and DEVELOPER may view another user's auth history.
// Each access is logged in AuthEventView for accountability.
export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) => {
    const session = await requireRole(["MANAGER", "DEVELOPER"], request);
    const { userId } = await params;

    const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
    });
    if (!target) return errorResponse("Utilisateur introuvable", 404);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const outcome = url.searchParams.get("outcome") as AuthOutcome | null;

    const [{ events, total }] = await Promise.all([
        getAuthEvents(userId, { limit, offset, ...(outcome ? { outcome } : {}) }),
        // Log the access (fire-and-forget within the same request is fine — we await it so audit
        // is consistent, but failures don't bubble up to the caller)
        logAuthEventView(session.user.id, userId, "VIEW_HISTORY").catch(() => {}),
    ]);

    return successResponse({ user: target, events, total, limit, offset });
});
