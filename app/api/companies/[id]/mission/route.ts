import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, requireRole, withErrorHandler } from "@/lib/api-utils";

// GET /api/companies/[id]/mission - Returns missionId for this company (for drawer "add action" form)
export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER", "SDR", "BUSINESS_DEVELOPER", "BOOKER"], request);
    const { id } = await params;

    const company = await prisma.company.findUnique({
        where: { id },
        select: {
            list: {
                select: { missionId: true },
            },
        },
    });

    if (!company?.list?.missionId) {
        return errorResponse("Société ou mission introuvable", 404);
    }

    return successResponse({ missionId: company.list.missionId });
});
