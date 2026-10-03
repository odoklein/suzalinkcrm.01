import { NextRequest, NextResponse } from 'next/server';
import { requireRole, successResponse, withErrorHandler } from '@/lib/api-utils';
import { getAvailableEndpoints } from '@/lib/api-keys';

// ============================================
// GET /api/manager/api-keys/endpoints
// Returns available endpoints for API key creation
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await requireRole(['MANAGER'], request);

  const endpoints = await getAvailableEndpoints(session.user.role);

  return successResponse(endpoints);
});
