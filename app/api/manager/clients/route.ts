import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, successResponse, withErrorHandler } from '@/lib/api-utils';

// ============================================
// GET /api/manager/clients
// Returns simple list of clients for dropdowns
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(['MANAGER'], request);

  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  return successResponse(clients);
});
