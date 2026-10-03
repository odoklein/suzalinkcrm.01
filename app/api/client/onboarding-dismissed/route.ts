import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";

// ============================================
// PATCH /api/client/onboarding-dismissed
// Mark client onboarding as permanently dismissed
// ============================================

export const PATCH = withErrorHandler(async () => {
    const session = await requireRole(["CLIENT"], request);

    await prisma.user.update({
        where: { id: session.user.id },
        data: { clientOnboardingDismissedPermanently: true },
    });

    return successResponse({ dismissed: true });
});
