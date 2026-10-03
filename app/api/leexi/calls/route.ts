import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
} from '@/lib/api-utils';
import { searchLeexiCalls, fetchLeexiCalls, isLeexiAvailable } from '@/lib/leexi/service';

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);

  if (!(await isLeexiAvailable())) {
    return errorResponse(
      'Leexi non configuré (LEEXI_API_KEY_ID / LEEXI_API_KEY_SECRET manquants)',
      503,
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  try {
    const calls = query
      ? await searchLeexiCalls(query)
      : await fetchLeexiCalls(page, 50);

    const formatted = calls.map((call) => ({
      id: call.id,
      title: call.title || 'Appel sans titre',
      date: call.date || null,
      duration: call.duration || 0,
      companyName: call.company_name || call.participants?.find((p) => p.company)?.company || '',
      participantNames: call.participants?.map((p) => p.name).filter(Boolean) || [],
      hasRecap: !!(call.recap || call.summary),
    }));

    return successResponse({ calls: formatted, total: formatted.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur Leexi';
    console.error('Leexi calls search error:', err);
    return errorResponse(message, 500);
  }
});
