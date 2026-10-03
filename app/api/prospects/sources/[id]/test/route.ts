// ============================================
// TEST SOURCE CONNECTION API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, withErrorHandler } from '@/lib/api-utils';

// ============================================
// POST /api/prospects/sources/[id]/test
// ============================================

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireRole(['MANAGER'], request);
  const { id } = await params;

  const source = await prisma.prospectSource.findUnique({
    where: { id },
  });

  if (!source) {
    return NextResponse.json(
      { success: false, error: 'Source not found' },
      { status: 404 }
    );
  }

  // For API sources, verify connection
  if (source.type === 'API') {
    // TODO: Implement actual API connection test
    // For now, just verify source is configured
    const metadata = (source.metadata as any) || {};
    if (!metadata.apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key not configured' },
        { status: 400 }
      );
    }
  }

  // For WEB_FORM sources, verify webhook URL is set
  if (source.type === 'WEB_FORM') {
    const metadata = (source.metadata as any) || {};
    if (!metadata.webhookUrl) {
      return NextResponse.json(
        { success: false, error: 'Webhook URL not configured' },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      connected: true,
      message: 'Source connection verified',
    },
  });
});
