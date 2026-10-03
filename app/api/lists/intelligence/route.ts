import { NextRequest } from 'next/server';
import { successResponse, requireRole, withErrorHandler, NotFoundError } from '@/lib/api-utils';
import { computeClientListsIntelligence } from '@/lib/services/ListHealthService';

// ============================================
// GET /api/lists/intelligence
// ============================================
// Returns client-level intelligence: cross-list rankings, stagnation alerts,
// top/bottom performers, and aggregate prospection stats.
//
// Query params:
//   clientId   — REQUIRED: the client to analyse
//   sdrIds[]   — scope actions to specific SDRs
//   from       — date range start (ISO string, default: -30 days)
//   to         — date range end (ISO string, default: now)
//
// Response: ClientListsIntelligence
// Roles: MANAGER, DEVELOPER

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER', 'DEVELOPER'], request);
    const { searchParams } = new URL(request.url);

    const clientId = searchParams.get('clientId');
    if (!clientId) {
        throw new NotFoundError('Paramètre clientId requis');
    }

    const sdrIds = searchParams.getAll('sdrIds[]');
    const fromRaw = searchParams.get('from');
    const toRaw = searchParams.get('to');

    const intelligence = await computeClientListsIntelligence(clientId, {
        sdrIds: sdrIds.length > 0 ? sdrIds : undefined,
        from: fromRaw ? new Date(fromRaw) : undefined,
        to: toRaw ? new Date(toRaw) : undefined,
    });

    if (!intelligence) {
        throw new NotFoundError('Client introuvable');
    }

    return successResponse(intelligence);
});
