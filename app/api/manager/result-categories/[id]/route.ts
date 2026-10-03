import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
} from "@/lib/api-utils";
import { z } from "zod";

const updateBodySchema = z.object({
    label: z.string().min(1).optional(),
    color: z.string().optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
    description: z.string().optional().nullable(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/manager/result-categories/[id]
 */
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(["MANAGER", "BUSINESS_DEVELOPER"], request);
    const { id } = await params;

    const category = await prisma.resultCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundError("Catégorie");

    return successResponse(category);
});

/**
 * PUT /api/manager/result-categories/[id]
 */
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(["MANAGER", "BUSINESS_DEVELOPER"], request);
    const { id } = await params;

    const category = await prisma.resultCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundError("Catégorie");

    const body = await request.json();
    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Données invalides";
        return errorResponse(msg, 400);
    }

    const updated = await prisma.resultCategory.update({
        where: { id },
        data: {
            ...(parsed.data.label !== undefined && { label: parsed.data.label }),
            ...(parsed.data.color !== undefined && { color: parsed.data.color }),
            ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
            ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        },
    });

    return successResponse(updated);
});

/**
 * DELETE /api/manager/result-categories/[id]
 */
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(["MANAGER", "BUSINESS_DEVELOPER"], request);
    const { id } = await params;

    const category = await prisma.resultCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundError("Catégorie");

    await prisma.resultCategory.delete({ where: { id } });

    return successResponse({ message: "Catégorie supprimée" });
});
