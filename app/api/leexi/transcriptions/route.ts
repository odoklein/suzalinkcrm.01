import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
} from '@/lib/api-utils';
import { fetchLeexiCalls, isLeexiAvailable } from '@/lib/leexi/service';
import { companiesMatch } from '@/lib/leexi/matching';

// ============================================
// GET /api/leexi/transcriptions?clientId=xxx
// Returns Leexi calls formatted as LeexiTranscription[]
// Optionally filtered by client company name.
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);

  if (!(await isLeexiAvailable())) {
    return errorResponse(
      'Leexi non configuré (LEEXI_API_KEY_ID / LEEXI_API_KEY_SECRET manquants)',
      503,
    );
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  // Fetch most recent 100 calls from Leexi
  const allCalls = await fetchLeexiCalls(1, 100);

  // If clientId given, try to filter by company name match
  let filteredCalls = allCalls;
  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { name: true },
    });
    if (client?.name) {
      const matched = allCalls.filter((call) => {
        const companyName =
          call.company_name ||
          call.participants?.find((p) => p.company)?.company ||
          '';
        return companiesMatch(client.name, companyName);
      });
      // Fall back to all calls if no match found (user can still pick manually)
      filteredCalls = matched.length > 0 ? matched : allCalls;
    }
  }

  const transcriptions = filteredCalls.map((call) => ({
    id: call.id,
    title: call.title || 'Appel sans titre',
    date: call.date || new Date().toISOString(),
    duration: call.duration || 0,
    participants: call.participants?.map((p) => p.name).filter(Boolean) as string[] || [],
    recordingUrl: undefined as string | undefined,
  }));

  return successResponse(transcriptions);
});
