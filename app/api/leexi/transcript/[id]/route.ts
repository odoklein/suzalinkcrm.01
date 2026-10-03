import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
} from '@/lib/api-utils';
import { fetchLeexiCallById, isLeexiAvailable } from '@/lib/leexi/service';

// ============================================
// GET /api/leexi/transcript/[id]
// Returns the full transcript/recap for a Leexi call.
// Used by the CR generation flow to get the raw text.
// ============================================

export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);

    if (!(await isLeexiAvailable())) {
      return errorResponse('Leexi non configuré', 503);
    }

    const { id } = await context.params;

    const call = await fetchLeexiCallById(id);

    // Priority: full transcript > recap > summary
    const transcript =
      call.transcript ||
      call.recap ||
      call.summary ||
      '';

    if (!transcript) {
      return errorResponse(
        'Aucune transcription disponible pour cet appel. Le traitement Leexi est peut-être encore en cours.',
        404,
      );
    }

    return successResponse({
      transcript,
      title: call.title || 'Appel sans titre',
      date: call.date || null,
      duration: call.duration || 0,
    });
  },
);
