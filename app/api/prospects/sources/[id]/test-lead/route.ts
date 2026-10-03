// ============================================
// TEST LEAD API
// Send a test lead through the source
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, withErrorHandler } from '@/lib/api-utils';
import { intakeLead } from '@/lib/prospects/intake-service';

// ============================================
// POST /api/prospects/sources/[id]/test-lead
// ============================================

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireRole(['MANAGER'], request);
  const { id } = await params;
  
  // Handle empty body gracefully - payload is optional
  let payload: any = undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === 'object' && 'payload' in body) {
      payload = body.payload;
    }
  } catch (error) {
    // If parsing fails, payload remains undefined (will use default)
    payload = undefined;
  }

  const source = await prisma.prospectSource.findUnique({
    where: { id },
  });

  if (!source) {
    return NextResponse.json(
      { success: false, error: 'Source not found' },
      { status: 404 }
    );
  }

  if (!source.isActive) {
    return NextResponse.json(
      { success: false, error: 'Source is not active' },
      { status: 400 }
    );
  }

  // Use provided payload or default test data
  const testPayload = payload || {
    firstName: 'Test',
    lastName: 'Lead',
    email: 'test@example.com',
    company: 'Test Company',
    phone: '+33612345678',
  };

  // Process intake
  const result = await intakeLead(id, testPayload, 'system-test');

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || 'Test lead failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      eventId: result.eventId,
      profileId: result.profileId,
      message: 'Test lead processed successfully',
    },
  });
});
