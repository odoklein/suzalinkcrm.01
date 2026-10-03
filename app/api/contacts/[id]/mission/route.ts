import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, requireRole, withErrorHandler } from "@/lib/api-utils";

// GET /api/contacts/[id]/mission - Returns missionId for this contact (for drawer "add action" form)
export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER", "SDR", "BUSINESS_DEVELOPER", "BOOKER"], request);
    const { id } = await params;

    const contact = await prisma.contact.findUnique({
        where: { id },
        select: {
            company: {
                select: {
                    list: {
                        select: { missionId: true },
                    },
                },
            },
        },
    });

    if (!contact?.company?.list?.missionId) {
        return errorResponse("Contact ou mission introuvable", 404);
    }

    return successResponse({ missionId: contact.company.list.missionId });
});
