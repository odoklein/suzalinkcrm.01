import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { z } from "zod";

/**
 * GET /api/manager/action-statuses/remap
 * Returns action counts grouped by result code, so the manager can see
 * which statuses are in use and how many actions each has.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);

    // Get counts of actions per result code
    const counts = await prisma.action.groupBy({
        by: ["result"],
        _count: { id: true },
    });

    // Get all distinct result codes currently in use
    const resultCodes = counts.map((c) => ({
        code: c.result,
        count: c._count.id,
    }));

    // Also get all global status definitions for reference
    const globalStatuses = await prisma.actionStatusDefinition.findMany({
        where: { scopeType: "GLOBAL", scopeId: "" },
        orderBy: { sortOrder: "asc" },
        select: { code: true, label: true, isActive: true },
    });

    // Get valid ActionResult enum values from PostgreSQL
    const enumRows = await prisma.$queryRaw<{ enumlabel: string }[]>`
        SELECT enumlabel FROM pg_enum
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ActionResult')
        ORDER BY enumsortorder
    `;
    const validEnumValues = enumRows.map((r) => r.enumlabel);

    const definedCodes = new Set(globalStatuses.map((s) => s.code));

    // Identify orphan codes (in use but not defined in global config)
    const orphanCodes = resultCodes
        .filter((r) => !definedCodes.has(r.code))
        .map((r) => r.code);

    return successResponse({
        resultCodes: resultCodes.sort((a, b) => b.count - a.count),
        globalStatuses,
        validEnumValues,
        orphanCodes,
        totalActions: counts.reduce((sum, c) => sum + c._count.id, 0),
    });
});

const remapSchema = z.object({
    mappings: z.array(
        z.object({
            fromCode: z.string().min(1),
            toCode: z.string().min(1),
        })
    ).min(1),
});

/**
 * POST /api/manager/action-statuses/remap
 * Bulk remap actions from one result code to another.
 * This updates all Action records matching the fromCode to the toCode.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);

    const body = await request.json();
    const parsed = remapSchema.safeParse(body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Données invalides";
        return errorResponse(msg, 400);
    }
    const { mappings } = parsed.data;

    // Fetch valid enum values from PostgreSQL to validate before executing
    const enumRows = await prisma.$queryRaw<{ enumlabel: string }[]>`
        SELECT enumlabel FROM pg_enum
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ActionResult')
        ORDER BY enumsortorder
    `;
    const validEnumValues = new Set(enumRows.map((r) => r.enumlabel));

    const activeGlobalStatuses = await prisma.actionStatusDefinition.findMany({
        where: { scopeType: "GLOBAL", scopeId: "", isActive: true },
        select: { code: true },
    });
    const activeGlobalCodes = new Set(activeGlobalStatuses.map((s) => s.code));

    // Pre-validate all target codes
    for (const { toCode } of mappings) {
        if (!validEnumValues.has(toCode)) {
            return errorResponse(
                `Code "${toCode}" n'est pas un ActionResult valide dans le schéma Prisma. Valeurs possibles : ${[...validEnumValues].join(", ")}`,
                400
            );
        }
        if (!activeGlobalCodes.has(toCode)) {
            return errorResponse(
                `Code cible "${toCode}" non autorisé: il doit être un statut GLOBAL actif.`,
                400
            );
        }
    }

    const normalizedMappings = mappings.filter((m) => m.fromCode !== m.toCode);
    if (normalizedMappings.length === 0) {
        return successResponse({
            mappings: [],
            totalUpdated: 0,
            deactivatedMissionStatuses: 0,
        });
    }

    const txResults = await prisma.$transaction(async (tx) => {
        const results: Array<{ fromCode: string; toCode: string; updated: number }> = [];

        for (const { fromCode, toCode } of normalizedMappings) {
            // Use text cast for fromCode to safely handle any edge cases
            const updated = await tx.$executeRaw`
                UPDATE "Action"
                SET "result" = ${toCode}::"ActionResult"
                WHERE "result"::text = ${fromCode}
            `;
            results.push({ fromCode, toCode, updated: Number(updated) });
        }

        // Deprecate legacy mission statuses that were mapped away.
        const mappedFromCodes = [...new Set(normalizedMappings.map((m) => m.fromCode))];
        const deactivated = await tx.actionStatusDefinition.updateMany({
            where: {
                scopeType: "MISSION",
                code: { in: mappedFromCodes },
                isActive: true,
            },
            data: { isActive: false },
        });

        return {
            mappings: results,
            totalUpdated: results.reduce((sum, r) => sum + r.updated, 0),
            deactivatedMissionStatuses: deactivated.count,
        };
    });

    return successResponse({
        mappings: txResults.mappings,
        totalUpdated: txResults.totalUpdated,
        deactivatedMissionStatuses: txResults.deactivatedMissionStatuses,
    });
});
