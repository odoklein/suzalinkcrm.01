import { NextRequest } from "next/server";
import { requireAuth, successResponse, withErrorHandler } from "@/lib/api-utils";
import { getAuthEvents } from "@/lib/auth-event";
import type { AuthOutcome } from "@prisma/client";

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireAuth(request);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30", 10), 100);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const outcome = url.searchParams.get("outcome") as AuthOutcome | null;

    const { events, total } = await getAuthEvents(session.user.id, {
        limit,
        offset,
        ...(outcome ? { outcome } : {}),
    });

    return successResponse({ events, total, limit, offset });
});
