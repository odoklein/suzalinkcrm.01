// ============================================
// PROSPECT ACTIVATION API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';
import { activateProspect } from '@/lib/prospects/activation-service';

// ============================================
// SCHEMAS
// ============================================

const activateSchema = z.object({
  missionId: z.string().min(1, 'Mission ID required'),
});

// ============================================
// POST /api/prospects/profiles/[id]/activate
// ============================================

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireRole(['MANAGER'], request);
  const { id } = await params;
  const { missionId } = await validateRequest(request, activateSchema);

  // Get profile
  const profile = await prisma.prospectProfile.findUnique({
    where: { id },
  });

  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Prospect not found' },
      { status: 404 }
    );
  }

  if (profile.status === 'ACTIVATED') {
    return NextResponse.json(
      { success: false, error: 'Prospect already activated' },
      { status: 400 }
    );
  }

  // Verify mission exists
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
  });

  if (!mission) {
    return NextResponse.json(
      { success: false, error: 'Mission not found' },
      { status: 404 }
    );
  }

  // Assign prospect to mission first
  await prisma.prospectProfile.update({
    where: { id },
    data: {
      assignedMissionId: missionId,
    },
  });

  // Activate prospect (creates Contact/Company and adds to mission list)
  try {
    const result = await activateProspect(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Activation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        contactId: result.contactId,
        companyId: result.companyId,
        listId: result.listId,
        message: 'Prospect activated and added to mission',
      },
    });
  } catch (error: any) {
    console.error('Activation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Activation failed' },
      { status: 500 }
    );
  }
});
