import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
} from '@/lib/api-utils';
import { fetchLeexiRecaps, isLeexiAvailable } from '@/lib/leexi/service';
import { matchRecapsToClients } from '@/lib/leexi/matching';

// ============================================
// GET /api/leexi/recaps
// Fetch live Leexi recaps and match to CRM clients
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(['MANAGER'], request);

  if (!(await isLeexiAvailable())) {
    return errorResponse(
      'Leexi non configuré (LEEXI_API_KEY_ID / LEEXI_API_KEY_SECRET manquants)',
      503,
    );
  }

  try {
    const [recaps, clients] = await Promise.all([
      fetchLeexiRecaps(1, 50),
      prisma.client.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const matched = matchRecapsToClients(clients, recaps);

    const unmatched = recaps.filter(
      (r) => !matched.some((m) => m.recaps.some((mr) => mr.id === r.id)),
    );

    return successResponse({
      matched,
      unmatched,
      totalRecaps: recaps.length,
      totalMatched: matched.reduce((acc, m) => acc + m.recaps.length, 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur Leexi';
    console.error('Leexi recaps error:', err);
    return errorResponse(message, 500);
  }
});
