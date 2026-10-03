import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  requirePlanningAccess,
  withErrorHandler,
} from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string; overrideId: string }>;
}

/**
 * DELETE /api/planning/sdrs/[id]/overrides/[overrideId]
 *
 * Deletes an SdrDayOverride. The id in the path must match the override's sdrId.
 */
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
  await requirePlanningAccess(request);
  const { id: sdrId, overrideId } = await params;

  const override = await prisma.sdrDayOverride.findUnique({
    where: { id: overrideId },
    select: { id: true, sdrId: true },
  });

  if (!override) {
    return errorResponse('Override introuvable', 404);
  }

  if (override.sdrId !== sdrId) {
    return errorResponse('Override ne correspond pas à cet SDR', 403);
  }

  await prisma.sdrDayOverride.delete({
    where: { id: overrideId },
  });

  return successResponse({ message: 'Override supprimé' });
});
