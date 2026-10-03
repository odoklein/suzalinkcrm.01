// ============================================
// PROSPECT REVIEW API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';
import { ProspectStatus, ProspectPipelineStep } from '@prisma/client';
import { scheduleProspectProcessing } from '@/lib/prospects/queue';

// ============================================
// SCHEMAS
// ============================================

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

// ============================================
// PATCH /api/prospects/profiles/[id]/review
// ============================================

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireRole(['MANAGER'], request);
  const { id } = await params;
  const data = await validateRequest(request, reviewSchema);

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

  if (!profile.reviewRequired && profile.status !== ProspectStatus.IN_REVIEW) {
    return NextResponse.json(
      { success: false, error: 'Prospect does not require review' },
      { status: 400 }
    );
  }

  // Get session (already checked above, but need user ID)
  const session = await requireRole(['MANAGER'], request);

    if (data.action === 'approve') {
      // Approve and continue pipeline
      const profile = await prisma.prospectProfile.findUnique({ where: { id } });
      
      await prisma.prospectProfile.update({
        where: { id },
        data: {
          status: ProspectStatus.APPROVED,
          reviewRequired: false,
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          reviewNotes: data.reason || 'Approved by manager',
        },
      });

      // Continue processing (move to next step)
      const { processProfile } = await import('@/lib/prospects/pipeline-service');
      try {
        await processProfile(id);
      } catch (error) {
        console.error('Failed to resume pipeline after approval:', error);
        // Don't fail the request - profile is already approved
      }
    } else if (data.action === 'reject') {
      // Reject permanently
      await prisma.prospectProfile.update({
        where: { id },
        data: {
          status: ProspectStatus.REJECTED,
          reviewRequired: false,
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          reviewNotes: data.reason || 'Rejected by manager',
        },
      });
    }

  return NextResponse.json({
    success: true,
    data: { id, status: data.action === 'approve' ? 'APPROVED' : 'REJECTED' },
  });
});
