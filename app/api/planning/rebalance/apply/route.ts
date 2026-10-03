import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  requirePlanningAccess,
  withErrorHandler,
  validateRequest,
} from '@/lib/api-utils';
import { recomputeConflicts } from '@/lib/planning/conflictEngine';
import { z } from 'zod';

const applySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
  changes: z.array(
    z.object({
      blockId: z.string().min(1),
      toSdrId: z.string().min(1),
    })
  ),
});

/**
 * POST /api/planning/rebalance/apply
 *
 * Body: { month, changes: [{ blockId, toSdrId }] }
 * Reassigns blocks to the specified SDRs. Updates allocation counters.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  await requirePlanningAccess(request);
  const data = await validateRequest(request, applySchema);

  if (!data.changes.length) {
    return errorResponse('Aucun changement à appliquer', 400);
  }

  const updated: { id: string; sdrId: string; missionId: string }[] = [];

  for (const { blockId, toSdrId } of data.changes) {
    const block = await prisma.scheduleBlock.findUnique({
      where: { id: blockId },
      include: {
        allocation: {
          select: { id: true, missionMonthPlan: { select: { id: true, missionId: true, month: true } } },
        },
      },
    });

    if (!block) {
      return errorResponse(`Bloc ${blockId} introuvable`, 404);
    }

    const assignment = await prisma.sDRAssignment.findFirst({
      where: { sdrId: toSdrId, missionId: block.missionId },
    });

    if (!assignment) {
      return errorResponse(`Le SDR ${toSdrId} n'est pas assigné à cette mission`, 400);
    }

    const oldSdrId = block.sdrId;
    if (oldSdrId === toSdrId) continue;

    await prisma.$transaction(async (tx) => {
      await tx.scheduleBlock.update({
        where: { id: blockId },
        data: { sdrId: toSdrId },
      });

      if (block.allocationId) {
        await tx.sdrDayAllocation.update({
          where: { id: block.allocationId },
          data: { scheduledDays: { decrement: 1 } },
        });
      }

      let missionId = block.missionId;
      let month = data.month;
      if (block.allocation?.missionMonthPlan) {
        missionId = block.allocation.missionMonthPlan.missionId;
        month = block.allocation.missionMonthPlan.month;
      } else {
        const mp = await tx.missionMonthPlan.findFirst({
          where: { missionId: block.missionId, month: data.month },
          select: { missionId: true, month: true },
        });
        if (mp) {
          missionId = mp.missionId;
          month = mp.month;
        }
      }

      const newAlloc = await tx.sdrDayAllocation.findFirst({
        where: {
          sdrId: toSdrId,
          missionMonthPlan: { missionId, month },
        },
      });

      if (newAlloc) {
        await tx.sdrDayAllocation.update({
          where: { id: newAlloc.id },
          data: { scheduledDays: { increment: 1 } },
        });
      }
    });

    updated.push({ id: blockId, sdrId: toSdrId, missionId: block.missionId });

    const planMonth =
      block.allocation?.missionMonthPlan?.month ??
      (await prisma.missionMonthPlan.findFirst({
        where: { missionId: block.missionId, month: data.month },
        select: { month: true },
      }))?.month ??
      data.month;

    if (planMonth) {
      await recomputeConflicts({
        sdrId: oldSdrId,
        missionId: block.missionId,
        month: planMonth,
      });
      await recomputeConflicts({
        sdrId: toSdrId,
        missionId: block.missionId,
        month: planMonth,
      });
    }
  }

  return successResponse({ applied: updated.length, updated });
});
