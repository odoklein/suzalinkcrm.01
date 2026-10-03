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

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  scope: z.enum(['GLOBAL', 'CLIENT']).optional(),
  clientId: z.string().optional(),
});

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  label: z.string().optional().nullable(),
  scope: z.enum(['GLOBAL', 'CLIENT']).default('GLOBAL'),
  clientId: z.string().nullable().optional(),
});

/**
 * GET /api/planning/holidays?month=YYYY-MM&scope=GLOBAL&clientId=...
 *
 * Returns PlanningHoliday records.
 * Optional filters: month, scope, clientId.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  await requirePlanningAccess(request);
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    month: searchParams.get('month') ?? undefined,
    scope: searchParams.get('scope') ?? undefined,
    clientId: searchParams.get('clientId') ?? undefined,
  });

  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0]?.message ?? 'Paramètres invalides', 400);
  }

  const where: Record<string, unknown> = {};
  if (parsed.data.month) {
    const [year, m] = parsed.data.month.split('-').map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0);
    where.date = { gte: start, lte: end };
  }
  if (parsed.data.scope) {
    where.scope = parsed.data.scope;
  }
  if (parsed.data.clientId) {
    where.clientId = parsed.data.clientId;
  }

  const holidays = await prisma.planningHoliday.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  return successResponse(holidays);
});

/**
 * POST /api/planning/holidays
 *
 * Body: { date, label?, scope?, clientId? }
 * Creates a PlanningHoliday.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  await requirePlanningAccess(request);
  const data = await validateRequest(request, postSchema);

  if (data.scope === 'CLIENT' && !data.clientId) {
    return errorResponse('clientId requis pour scope CLIENT', 400);
  }

  const holiday = await prisma.planningHoliday.create({
    data: {
      date: new Date(data.date + 'T12:00:00'),
      label: data.label ?? null,
      scope: data.scope,
      clientId: data.clientId ?? null,
    },
  });

  return successResponse(holiday, 201);
});
