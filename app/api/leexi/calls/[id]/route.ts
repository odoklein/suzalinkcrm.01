import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
} from '@/lib/api-utils';
import { fetchLeexiCallById, isLeexiAvailable } from '@/lib/leexi/service';

export const GET = withErrorHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);

  if (!(await isLeexiAvailable())) {
    return errorResponse('Leexi non configuré', 503);
  }

  const { id } = await context.params;

  try {
    const call = await fetchLeexiCallById(id);

    const recapText = call.recap || call.summary || call.transcript?.slice(0, 10000) || '';

    return successResponse({
      id: call.id,
      title: call.title || 'Appel sans titre',
      date: call.date || null,
      duration: call.duration || 0,
      companyName: call.company_name || call.participants?.find((p) => p.company)?.company || '',
      participants: call.participants || [],
      recapText,
      hasTranscript: !!call.transcript,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur Leexi';
    console.error('Leexi call detail error:', err);
    return errorResponse(message, 500);
  }
});
