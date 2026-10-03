import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  requirePlanningAccess,
  withErrorHandler,
} from '@/lib/api-utils';
import { z } from 'zod';

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
});

/**
 * GET /api/planning/phantom-blocks?month=YYYY-MM
 *
 * Returns ScheduleBlocks that fall outside their mission's startDate/endDate window.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  await requirePlanningAccess(request);
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ month: searchParams.get('month') });

  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0]?.message ?? 'Paramètre month requis', 400);
  }

  const { month } = parsed.data;
  const [year, m] = month.split('-').map(Number);
  const monthStart = new Date(year, m - 1, 1);
  const monthEnd = new Date(year, m, 0);

  const blocks = await prisma.scheduleBlock.findMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
      status: { not: 'CANCELLED' },
      OR: [{ suggestionStatus: null }, { suggestionStatus: 'CONFIRMED' }],
    },
    include: {
      sdr: { select: { id: true, name: true } },
      mission: { select: { id: true, name: true, startDate: true, endDate: true } },
    },
  });

  const phantoms = blocks.filter((b) => {
    const start = new Date(b.mission.startDate);
    const end = new Date(b.mission.endDate);
    const d = new Date(b.date);
    return d < start || d > end;
  });

  return successResponse(phantoms);
});

/**
 * DELETE /api/planning/phantom-blocks?ids=id1,id2
 *
 * Deletes the specified phantom blocks. ids=comma-separated block IDs.
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  await requirePlanningAccess(request);
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids');
  const ids = idsParam ? idsParam.split(',').filter(Boolean) : [];

  if (ids.length === 0) {
    return errorResponse('Paramètre ids requis (ids=id1,id2)', 400);
  }

  const deleted = await prisma.scheduleBlock.deleteMany({
    where: {
      id: { in: ids },
      status: { not: 'CANCELLED' },
    },
  });

  return successResponse({ deleted: deleted.count });
});
