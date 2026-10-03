import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    NotFoundError,
} from '@/lib/api-utils';
import { z } from 'zod';

const duplicateSchema = z.object({
    name: z.string().min(1).optional(),
    assignToListId: z.string().min(1).optional(),
});

// ============================================
// POST /api/campaigns/[id]/duplicate
// Clone a campaign within the same mission. Optionally re-assign one list to the copy.
// ============================================

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER', 'BOOKER'], request);
    const { id } = await params;
    const data = await validateRequest(request, duplicateSchema);

    const source = await prisma.campaign.findUnique({
        where: { id },
        select: {
            id: true,
            missionId: true,
            name: true,
            icp: true,
            pitch: true,
            script: true,
            rules: true,
        },
    });

    if (!source) {
        throw new NotFoundError('Stratégie introuvable');
    }

    let assignList: { id: string } | null = null;
    if (data.assignToListId) {
        const list = await prisma.list.findFirst({
            where: { id: data.assignToListId, missionId: source.missionId },
            select: { id: true },
        });
        if (!list) {
            return errorResponse(
                'Cette liste n’appartient pas à la même mission que la stratégie',
                400
            );
        }
        assignList = list;
    }

    const created = await prisma.$transaction(async (tx) => {
        const copy = await tx.campaign.create({
            data: {
                missionId: source.missionId,
                name: data.name?.trim() || `${source.name} (copie)`,
                icp: source.icp,
                pitch: source.pitch,
                script: source.script,
                rules: source.rules ?? undefined,
                isActive: true,
            },
        });

        if (assignList) {
            await tx.list.update({
                where: { id: assignList.id },
                data: { campaignId: copy.id },
            });
        }

        return copy;
    });

    return successResponse(created, 201);
});
