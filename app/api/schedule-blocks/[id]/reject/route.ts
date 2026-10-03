import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
} from '@/lib/api-utils';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;

    const block = await prisma.scheduleBlock.findUnique({
        where: { id },
    });

    if (!block) {
        throw new NotFoundError('Créneau introuvable');
    }

    if (block.suggestionStatus !== 'SUGGESTED') {
        return successResponse({ message: 'Déjà traité' });
    }

    await prisma.scheduleBlock.update({
        where: { id },
        data: { suggestionStatus: 'REJECTED' },
    });

    return successResponse({ message: 'Créneau rejeté' });
});
