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

const weeklyPatternSchema = z.record(
  z.string().regex(/^[1-5]$/),
  z.union([z.literal(0), z.literal(0.5), z.literal(1)])
);

const putSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
  missionId: z.string().min(1, 'Mission requise'),
  weeklyPattern: weeklyPatternSchema,
});

/**
 * GET /api/planning/sdrs/[id]/availability?month=YYYY-MM
 *
 * Returns SdrMissionAvailability records for the SDR.
 * Optional month filter.
 */
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
  await requirePlanningAccess(request);
  const { id: sdrId } = await params;
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');

  const where: { sdrId: string; month?: string } = { sdrId };
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    where.month = month;
  }

  const availabilities = await prisma.sdrMissionAvailability.findMany({
    where,
    include: {
      mission: { select: { id: true, name: true } },
    },
    orderBy: [{ missionId: 'asc' }, { month: 'asc' }],
  });

  return successResponse(availabilities);
});

/**
 * PUT /api/planning/sdrs/[id]/availability
 *
 * Body: { month, missionId, weeklyPattern: { "1": 1, "2": 0.5, ... } }
 * Upserts SdrMissionAvailability. Keys 1-5 = Mon-Fri, values 0 | 0.5 | 1.
 */
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
  await requirePlanningAccess(request);
  const { id: sdrId } = await params;
  const data = await validateRequest(request, putSchema);

  const sdr = await prisma.user.findUnique({
    where: { id: sdrId },
    select: { id: true },
  });

  if (!sdr) {
    return errorResponse('SDR introuvable', 404);
  }

  const mission = await prisma.mission.findUnique({
    where: { id: data.missionId },
    select: { id: true },
  });

  if (!mission) {
    return errorResponse('Mission introuvable', 404);
  }

  const availability = await prisma.sdrMissionAvailability.upsert({
    where: {
      sdrId_missionId_month: {
        sdrId,
        missionId: data.missionId,
        month: data.month,
      },
    },
    create: {
      sdrId,
      missionId: data.missionId,
      month: data.month,
      weeklyPattern: data.weeklyPattern as object,
    },
    update: {
      weeklyPattern: data.weeklyPattern as object,
    },
    include: {
      mission: { select: { id: true, name: true } },
    },
  });

  return successResponse(availability);
});
