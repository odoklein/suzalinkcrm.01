import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  requirePlanningAccess,
  withErrorHandler,
  validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  missionId: z.string().nullable().optional(),
  capacity: z.union([z.literal(0), z.literal(0.5), z.literal(1)]),
  reason: z.string().optional().nullable(),
});

/**
 * GET /api/planning/sdrs/[id]/overrides?month=YYYY-MM
 *
 * Returns SdrDayOverride records for the SDR.
 * Optional month filter.
 */
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
  await requirePlanningAccess(request);
  const { id: sdrId } = await params;
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');

  const where: { sdrId: string } = { sdrId };

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    where.date = { gte: start, lte: end };
  }

  const overrides = await prisma.sdrDayOverride.findMany({
    where,
    include: {
      sdr: { select: { id: true, name: true } },
    },
    orderBy: { date: 'asc' },
  });

  return successResponse(overrides);
});

/**
 * POST /api/planning/sdrs/[id]/overrides
 *
 * Body: { date, missionId?, capacity, reason? }
 * Creates an SdrDayOverride. missionId null = applies to all missions.
 */
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
  await requirePlanningAccess(request);
  const { id: sdrId } = await params;
  const data = await validateRequest(request, postSchema);

  const sdr = await prisma.user.findUnique({
    where: { id: sdrId },
    select: { id: true },
  });

  if (!sdr) {
    return errorResponse('SDR introuvable', 404);
  }

  const date = new Date(data.date + 'T12:00:00');
  const missionId = data.missionId ?? null;

  const createData = {
    sdrId,
    date,
    missionId,
    capacity: data.capacity,
    reason: data.reason ?? null,
  };

  let override;
  if (missionId !== null) {
    override = await prisma.sdrDayOverride.upsert({
      where: {
        sdrId_date_missionId: { sdrId, date, missionId },
      },
      create: createData,
      update: { capacity: data.capacity, reason: data.reason ?? null },
      include: { sdr: { select: { id: true, name: true } } },
    });
  } else {
    const existing = await prisma.sdrDayOverride.findFirst({
      where: { sdrId, date, missionId: null },
    });
    if (existing) {
      override = await prisma.sdrDayOverride.update({
        where: { id: existing.id },
        data: { capacity: data.capacity, reason: data.reason ?? null },
        include: { sdr: { select: { id: true, name: true } } },
      });
      return successResponse(override, 200);
    } else {
      override = await prisma.sdrDayOverride.create({
        data: createData,
        include: { sdr: { select: { id: true, name: true } } },
      });
      return successResponse(override, 201);
    }
  }

  return successResponse(override, 201);
});
