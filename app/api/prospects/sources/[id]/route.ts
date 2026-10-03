// ============================================
// PROSPECT SOURCE API (Single)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';
import { ProspectSourceType } from '@prisma/client';

// ============================================
// SCHEMAS
// ============================================

const updateSourceSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.nativeEnum(ProspectSourceType).optional(),
  defaultMissionId: z.string().optional().nullable(),
  autoActivate: z.boolean().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

// ============================================
// GET /api/prospects/sources/[id]
// ============================================

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireRole(['MANAGER'], request);
  const { id } = await params;

  const source = await prisma.prospectSource.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      defaultMission: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          events: true,
        },
      },
    },
  });

  if (!source) {
    return NextResponse.json(
      { success: false, error: 'Source not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: source });
});

// ============================================
// PATCH /api/prospects/sources/[id]
// ============================================

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireRole(['MANAGER'], request);
  const { id } = await params;
  const data = await validateRequest(request, updateSourceSchema);

  const source = await prisma.prospectSource.update({
    where: { id },
    data: {
      ...data,
      defaultMissionId: data.defaultMissionId === null ? null : data.defaultMissionId,
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      defaultMission: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({ success: true, data: source });
});

// ============================================
// DELETE /api/prospects/sources/[id]
// ============================================

export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireRole(['MANAGER'], request);
  const { id } = await params;

  // Soft delete by deactivating
  await prisma.prospectSource.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
});
