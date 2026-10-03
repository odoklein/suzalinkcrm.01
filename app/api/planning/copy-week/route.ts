import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requirePlanningAccess,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { buildAbsenceDayKeySet, toDateKey } from '@/lib/planning/absences';
import { z } from 'zod';

// ============================================
// POST /api/planning/copy-week - Copy schedule from one week to another
// ============================================

const copyWeekSchema = z.object({
    sourceStartDate: z.string().min(1, 'Date source requise'),
    targetStartDate: z.string().min(1, 'Date cible requise'),
    sdrIds: z.array(z.string()).optional(), // If not provided, copy all
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requirePlanningAccess(request);
    const data = await validateRequest(request, copyWeekSchema);

    const sourceStart = new Date(data.sourceStartDate);
    const targetStart = new Date(data.targetStartDate);

    // Calculate end of source week (7 days)
    const sourceEnd = new Date(sourceStart);
    sourceEnd.setDate(sourceEnd.getDate() + 7);

    // Build where clause: only copy CONFIRMED or legacy (null) blocks, not SUGGESTED
    const where = {
        date: {
            gte: sourceStart,
            lt: sourceEnd,
        },
        status: { not: 'CANCELLED' as const },
        OR: [
            { suggestionStatus: null },
            { suggestionStatus: 'CONFIRMED' as const },
        ],
        ...(data.sdrIds && data.sdrIds.length > 0 ? { sdrId: { in: data.sdrIds } } : {}),
    };

    const sourceBlocks = await prisma.scheduleBlock.findMany({ where });

    if (sourceBlocks.length === 0) {
        return errorResponse('Aucun bloc à copier dans la semaine source', 400);
    }

    // Calculate day offset
    const dayOffset = Math.floor((targetStart.getTime() - sourceStart.getTime()) / (24 * 60 * 60 * 1000));

    // Create new blocks
    const createdBlocks = [];
    const errors = [];

    for (const block of sourceBlocks) {
        const blockDate = new Date(block.date);
        const newDate = new Date(blockDate);
        newDate.setDate(newDate.getDate() + dayOffset);

        // Check for existing block at target
        const existing = await prisma.scheduleBlock.findFirst({
            where: {
                sdrId: block.sdrId,
                date: newDate,
                startTime: block.startTime,
                status: { not: 'CANCELLED' },
            },
        });

        if (existing) {
            errors.push({
                sdrId: block.sdrId,
                date: newDate.toISOString(),
                reason: 'Bloc déjà existant',
            });
            continue;
        }

        // Overlapping blocks are allowed when copying a week. Conflicts remain visible
        // in planning instead of blocking the duplicate / overlapping placement.

        try {
            const newBlock = await prisma.scheduleBlock.create({
                data: {
                    sdrId: block.sdrId,
                    missionId: block.missionId,
                    date: newDate,
                    startTime: block.startTime,
                    endTime: block.endTime,
                    notes: block.notes,
                    suggestionStatus: 'CONFIRMED',
                    missionPlanId: null,
                    createdById: session.user.id,
                },
            });
            createdBlocks.push(newBlock);
        } catch (err) {
            errors.push({
                sdrId: block.sdrId,
                date: newDate.toISOString(),
                reason: 'Erreur de création',
            });
        }
    }

    return successResponse({
        created: createdBlocks.length,
        errors: errors.length,
        errorDetails: errors,
    });
});
