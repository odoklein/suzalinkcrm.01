import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, requireRole, withErrorHandler } from "@/lib/api-utils";

/**
 * GET /api/result-categories
 * List all result categories (for client portal Activité and manager status config).
 * Allowed: CLIENT (for portal), MANAGER, BUSINESS_DEVELOPER.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["CLIENT", "MANAGER", "BUSINESS_DEVELOPER"], request);

    const categories = await prisma.resultCategory.findMany({
        orderBy: { sortOrder: "asc" },
    });

    return successResponse(categories);
});
