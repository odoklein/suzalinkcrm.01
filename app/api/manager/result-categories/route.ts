import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { z } from "zod";

const createBodySchema = z.object({
    code: z.string().min(1).max(64).regex(/^[A-Z0-9_]+$/, "Code: majuscules, chiffres et underscores uniquement"),
    label: z.string().min(1),
    color: z.string().optional().nullable(),
    sortOrder: z.number().int().min(0).default(0),
    description: z.string().optional().nullable(),
});

/**
 * GET /api/manager/result-categories
 * List result categories (manager/BD).
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER", "BUSINESS_DEVELOPER"], request);

    const categories = await prisma.resultCategory.findMany({
        orderBy: { sortOrder: "asc" },
    });

    return successResponse(categories);
});

/**
 * POST /api/manager/result-categories
 * Create a result category.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER", "BUSINESS_DEVELOPER"], request);

    const body = await request.json();
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Données invalides";
        return errorResponse(msg, 400);
    }
    const { code, label, color, sortOrder, description } = parsed.data;

    const existing = await prisma.resultCategory.findUnique({ where: { code } });
    if (existing) {
        return errorResponse("Une catégorie avec ce code existe déjà", 400);
    }

    const category = await prisma.resultCategory.create({
        data: { code, label, color: color ?? null, sortOrder, description: description ?? null },
    });

    return successResponse(category);
});
