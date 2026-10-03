import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    AuthError,
} from "@/lib/api-utils";

// ============================================
// GET /api/client/mailbox - Get client's connected mailbox (CLIENT only)
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);

    const mailbox = await prisma.mailbox.findFirst({
        where: {
            ownerId: session.user.id,
            isActive: true,
        },
        select: {
            id: true,
            email: true,
            displayName: true,
            provider: true,
            syncStatus: true,
            type: true,
            createdAt: true,
        },
    });

    if (!mailbox) {
        return successResponse(null);
    }

    return successResponse({
        id: mailbox.id,
        email: mailbox.email,
        displayName: mailbox.displayName,
        provider: mailbox.provider,
        syncStatus: mailbox.syncStatus,
        type: mailbox.type,
        connectedAt: mailbox.createdAt,
    });
});
