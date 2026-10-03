import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    getPaginationParams,
} from '@/lib/api-utils';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createCampaignSchema = z.object({
    name: z.string().min(1, 'Nom requis'),
    missionId: z.string().min(1, 'Mission requise'),
    icp: z.string().optional().default(''),
    pitch: z.string().optional().default(''),
    script: z.union([
        z.string(),
        z.object({
            intro: z.string().optional(),
            discovery: z.string().optional(),
            objection: z.string().optional(),
            closing: z.string().optional(),
        }),
    ]).optional(),
    assignToListIds: z.array(z.string().min(1)).optional(),
});

function normalizeScriptToSingleText(script: unknown): string | null {
    if (typeof script === 'string') return script;
    if (script && typeof script === 'object') {
        const parsed = script as Record<string, unknown>;
        const ordered = [
            ['Introduction', parsed.intro],
            ['Decouverte', parsed.discovery],
            ['Objections', parsed.objection],
            ['Closing', parsed.closing],
        ]
            .map(([label, value]) =>
                typeof value === 'string' && value.trim() ? `--- ${label} ---\n${value.trim()}` : null
            )
            .filter((v): v is string => Boolean(v));
        return ordered.join('\n\n');
    }
    return null;
}

// ============================================
// GET /api/campaigns - List campaigns
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER', 'CLIENT', 'BUSINESS_DEVELOPER', 'SDR', 'BOOKER'], request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);

    const missionId = searchParams.get('missionId');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');

    const where: any = {};

    if (missionId) {
        where.missionId = missionId;
    }

    if (isActive !== null) {
        where.isActive = isActive === 'true';
    }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { icp: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [campaigns, total] = await Promise.all([
        prisma.campaign.findMany({
            where,
            include: {
                mission: {
                    select: {
                        id: true,
                        name: true,
                        channel: true,
                        client: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        actions: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.campaign.count({ where }),
    ]);

    return successResponse(campaigns);
});

// ============================================
// POST /api/campaigns - Create campaign
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER', 'BOOKER'], request);
    const data = await validateRequest(request, createCampaignSchema);

    // Verify mission exists
    const mission = await prisma.mission.findUnique({
        where: { id: data.missionId },
    });

    if (!mission) {
        return errorResponse('Mission non trouvée', 404);
    }

    // Validate any requested list assignments belong to the same mission
    const listsToAssign = data.assignToListIds && data.assignToListIds.length > 0
        ? await prisma.list.findMany({
            where: { id: { in: data.assignToListIds }, missionId: data.missionId },
            select: { id: true },
        })
        : [];
    if (data.assignToListIds && listsToAssign.length !== data.assignToListIds.length) {
        return errorResponse(
            'Une ou plusieurs listes n’appartiennent pas à cette mission',
            400
        );
    }

    const campaign = await prisma.$transaction(async (tx) => {
        const created = await tx.campaign.create({
            data: {
                name: data.name,
                missionId: data.missionId,
                icp: data.icp,
                pitch: data.pitch,
                script: data.script ? normalizeScriptToSingleText(data.script) : null,
                isActive: true,
            },
            include: {
                mission: {
                    select: {
                        id: true,
                        name: true,
                        channel: true,
                    },
                },
            },
        });

        if (listsToAssign.length > 0) {
            await tx.list.updateMany({
                where: { id: { in: listsToAssign.map((l) => l.id) } },
                data: { campaignId: created.id },
            });
        }

        return created;
    });

    return successResponse(campaign, 201);
});
