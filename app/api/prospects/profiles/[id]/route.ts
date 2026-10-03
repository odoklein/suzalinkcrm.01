// ============================================
// PROSPECT PROFILE API (Single)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, withErrorHandler } from '@/lib/api-utils';

// ============================================
// GET /api/prospects/profiles/[id]
// ============================================

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);
  const { id } = await params;

  const profile = await prisma.prospectProfile.findUnique({
    where: { id },
    include: {
      assignedMission: {
        select: {
          id: true,
          name: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      assignedSdr: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          source: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
      decisionLogs: {
        orderBy: { executedAt: 'desc' },
        take: 50,
        include: {
          rule: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Prospect not found' },
      { status: 404 }
    );
  }

  // Get source from the first event (intake event)
  const intakeEvent = profile.events.find((e) => e.eventType === 'intake') || profile.events[0];
  const source = intakeEvent?.source || null;

  // Transform response to include source at profile level for convenience
  const response = {
    ...profile,
    source,
    events: profile.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      step: e.step,
      rawPayload: e.rawPayload,
      processedAt: e.processedAt,
      processedBy: e.processedBy,
      source: e.source,
    })),
  };

  return NextResponse.json({ success: true, data: response });
});
