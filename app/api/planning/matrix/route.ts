import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  requirePlanningAccess,
  withErrorHandler,
  validateRequest,
} from '@/lib/api-utils';
import { buildCapacityMatrix } from '@/lib/planning/capacityMatrix';
import { z } from 'zod';

const matrixQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
  sdrIds: z.string().optional().transform((s) => (s ? s.split(',').filter(Boolean) : undefined)),
  missionIds: z.string().optional().transform((s) => (s ? s.split(',').filter(Boolean) : undefined)),
});

const matrixPostSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
  sdrIds: z.array(z.string()).optional(),
  missionIds: z.array(z.string()).optional(),
  proposedChanges: z
    .array(
      z.object({
        blockId: z.string(),
        fromSdrId: z.string(),
        toSdrId: z.string(),
        date: z.string(),
        missionId: z.string(),
      })
    )
    .optional(),
});

/**
 * GET /api/planning/matrix?month=YYYY-MM&sdrIds=id1,id2&missionIds=id1,id2
 *
 * Returns the capacity matrix for the given month.
 * If sdrIds/missionIds omitted, uses active SDRs and missions for that month.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  await requirePlanningAccess(request);
  const { searchParams } = new URL(request.url);
  const parsed = matrixQuerySchema.safeParse({
    month: searchParams.get('month'),
    sdrIds: searchParams.get('sdrIds') ?? undefined,
    missionIds: searchParams.get('missionIds') ?? undefined,
  });

  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0]?.message ?? 'Paramètres invalides', 400);
  }

  const { month, sdrIds: querySdrIds, missionIds: queryMissionIds } = parsed.data;

  let sdrIds = querySdrIds;
  let missionIds = queryMissionIds;

  const [year, m] = month.split('-').map(Number);
  const monthStart = new Date(year, m - 1, 1);
  const monthEnd = new Date(year, m, 0);

  if (!missionIds?.length) {
    const missions = await prisma.mission.findMany({
      where: {
        isActive: true,
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      select: { id: true },
    });
    missionIds = missions.map((x) => x.id);
  }

  if (!sdrIds?.length) {
    const sdrs = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['SDR', 'BUSINESS_DEVELOPER'] },
      },
      select: { id: true },
    });
    sdrIds = sdrs.map((x) => x.id);
  }

  if (!sdrIds.length || !missionIds.length) {
    return successResponse({
      month,
      workingDays: [],
      sdrIds: [],
      missionIds: [],
      sdrNames: {},
      missionNames: {},
      missionColors: {},
      cells: [],
      missionCoverage: [],
      conflicts: [],
    });
  }

  const matrix = await buildCapacityMatrix(month, sdrIds, missionIds, prisma);
  return successResponse(matrix);
});

/**
 * POST /api/planning/matrix
 *
 * Body: { month, sdrIds?, missionIds?, proposedChanges? }
 * Returns matrix with optional preview overlay from proposedChanges.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  await requirePlanningAccess(request);
  const data = await validateRequest(request, matrixPostSchema);

  let { sdrIds, missionIds } = data;

  const [year, m] = data.month.split('-').map(Number);
  const monthStart = new Date(year, m - 1, 1);
  const monthEnd = new Date(year, m, 0);

  if (!missionIds?.length) {
    const missions = await prisma.mission.findMany({
      where: {
        isActive: true,
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      select: { id: true },
    });
    missionIds = missions.map((x) => x.id);
  }

  if (!sdrIds?.length) {
    const sdrs = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['SDR', 'BUSINESS_DEVELOPER'] },
      },
      select: { id: true },
    });
    sdrIds = sdrs.map((x) => x.id);
  }

  if (!sdrIds.length || !missionIds.length) {
    return successResponse({
      month: data.month,
      workingDays: [],
      sdrIds: [],
      missionIds: [],
      sdrNames: {},
      missionNames: {},
      missionColors: {},
      cells: [],
      missionCoverage: [],
      conflicts: [],
    });
  }

  const matrix = await buildCapacityMatrix(
    data.month,
    sdrIds,
    missionIds,
    prisma,
    data.proposedChanges
  );
  return successResponse(matrix);
});
