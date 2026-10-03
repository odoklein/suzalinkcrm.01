import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  requirePlanningAccess,
  withErrorHandler,
  validateRequest,
} from '@/lib/api-utils';
import { computeRebalanceProposal } from '@/lib/planning/rebalanceProposal';
import { buildCapacityMatrix } from '@/lib/planning/capacityMatrix';
import { z } from 'zod';

const proposeSchema = z.object({
  absentSdrId: z.string().min(1, 'SDR absent requis'),
  absenceDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, 'Dates d\'absence requises'),
  affectedMissionIds: z.array(z.string()).optional().default([]),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
});

/**
 * POST /api/planning/rebalance/propose
 *
 * Body: { absentSdrId, absenceDates: string[], affectedMissionIds?: string[], month }
 * Returns a rebalance proposal for blocks affected by the SDR's absence.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  await requirePlanningAccess(request);
  const data = await validateRequest(request, proposeSchema);

  const absenceDates = data.absenceDates.map((s) => new Date(s + 'T12:00:00'));

  let affectedMissionIds = data.affectedMissionIds;
  if (!affectedMissionIds?.length) {
    const assignments = await prisma.sDRAssignment.findMany({
      where: { sdrId: data.absentSdrId },
      select: { missionId: true },
    });
    affectedMissionIds = assignments.map((a) => a.missionId);
  }

  if (!affectedMissionIds.length) {
    return successResponse({
      cause: 'Aucune mission assignée',
      affectedDays: 0,
      rows: [],
      summary: { autoResolved: 0, overloadWarns: 0, unresolved: 0 },
    });
  }

  const [year, m] = data.month.split('-').map(Number);
  const monthEnd = new Date(year, m, 0);
  const monthStart = new Date(year, m - 1, 1);

  const sdrs = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['SDR', 'BUSINESS_DEVELOPER'] },
    },
    select: { id: true },
  });
  const sdrIds = sdrs.map((x) => x.id);

  const currentMatrix = await buildCapacityMatrix(
    data.month,
    sdrIds,
    affectedMissionIds,
    prisma
  );

  const proposal = await computeRebalanceProposal({
    absentSdrId: data.absentSdrId,
    absenceDates,
    affectedMissionIds,
    month: data.month,
    prisma,
    currentMatrix,
  });

  return successResponse(proposal);
});
