import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

// ============================================
// GET /api/analyse-ia/[id]
// ============================================

export const GET = withErrorHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);
    const { id } = await context.params;

    const analysis = await prisma.weeklyAnalysis.findUnique({ where: { id } });
    if (!analysis) return errorResponse('Analyse introuvable', 404);

    return successResponse({ analysis });
});

// ============================================
// PATCH /api/analyse-ia/[id]
// Update recommendation outcomes (feedback loop)
// ============================================

const feedbackSchema = z.object({
    recommendationOutcomes: z.array(z.object({
        recommendationId: z.string(),
        status: z.enum(['applied', 'ignored', 'partial']),
        outcome: z.string().optional(),
        appliedAt: z.string().optional(),
    })),
});

export const PATCH = withErrorHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);
    const { id } = await context.params;

    const existing = await prisma.weeklyAnalysis.findUnique({ where: { id } });
    if (!existing) return errorResponse('Analyse introuvable', 404);

    const body = await validateRequest(request, feedbackSchema);

    const updated = await prisma.weeklyAnalysis.update({
        where: { id },
        data: {
            recommendationOutcomes: body.recommendationOutcomes as any,
            updatedAt: new Date(),
        },
    });

    return successResponse({ analysis: updated });
});
