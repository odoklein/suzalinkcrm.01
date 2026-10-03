// ============================================
// PROSPECT RULES API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, withErrorHandler, validateRequest, getPaginationParams, paginatedResponse } from '@/lib/api-utils';
import { z } from 'zod';
import { ProspectPipelineStep } from '@prisma/client';

// ============================================
// SCHEMAS
// ============================================

const createRuleSchema = z.object({
  name: z.string().min(1, 'Name required'),
  description: z.string().optional(),
  clientId: z.string().optional(),
  sourceId: z.string().optional(),
  step: z.nativeEnum(ProspectPipelineStep),
  priority: z.number().int().default(0),
  condition: z.record(z.any()),
  action: z.record(z.any()),
});

// ============================================
// GET /api/prospects/rules
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(['MANAGER'], request);
  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = getPaginationParams(searchParams);

  const step = searchParams.get('step');
  const clientId = searchParams.get('clientId');

  const where: any = {
    isActive: true,
  };

  if (step) {
    where.step = step;
  }

  if (clientId) {
    where.clientId = clientId;
  }

  const total = await prisma.prospectRule.count({ where });

  const rules = await prisma.prospectRule.findMany({
    where,
    skip,
    take: limit,
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      source: {
        select: {
          id: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return paginatedResponse(rules, total, page, limit);
});

// ============================================
// POST /api/prospects/rules
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await requireRole(['MANAGER'], request);
  const data = await validateRequest(request, createRuleSchema);

  const rule = await prisma.prospectRule.create({
    data: {
      ...data,
      createdById: session.user.id,
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      source: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({ success: true, data: rule }, { status: 201 });
});
