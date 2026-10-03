// ============================================
// PROSPECT RULE API (Single)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';
import { ProspectPipelineStep } from '@prisma/client';

// ============================================
// SCHEMAS
// ============================================

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  condition: z.record(z.any()).optional(),
  action: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// GET /api/prospects/rules/[id]
// ============================================

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireRole(['MANAGER'], request);
  const { id } = await params;

  const rule = await prisma.prospectRule.findUnique({
    where: { id },
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
      updatedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!rule) {
    return NextResponse.json(
      { success: false, error: 'Rule not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: rule });
});

// ============================================
// PATCH /api/prospects/rules/[id]
// ============================================

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await requireRole(['MANAGER'], request);
  const { id } = await params;
  const data = await validateRequest(request, updateRuleSchema);

  const rule = await prisma.prospectRule.update({
    where: { id },
    data: {
      ...data,
      updatedById: session.user.id,
      version: { increment: 1 },
    },
  });

  return NextResponse.json({ success: true, data: rule });
});

// ============================================
// DELETE /api/prospects/rules/[id]
// ============================================

export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireRole(['MANAGER'], request);
  const { id } = await params;

  // Soft delete by deactivating
  await prisma.prospectRule.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
});
