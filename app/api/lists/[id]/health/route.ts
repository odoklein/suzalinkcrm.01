import { NextRequest } from 'next/server';
import { successResponse, requireRole, withErrorHandler, NotFoundError } from '@/lib/api-utils';
import { computeListHealth } from '@/lib/services/ListHealthService';

// ============================================
// GET /api/lists/[id]/health
// ============================================
// Returns the full Prospection Health metrics for a single list.
//
// Query params:
//   sdrIds[]  — filter to actions by specific SDRs
//
// Response: ListHealthMetrics
// Roles: MANAGER, DEVELOPER

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'DEVELOPER'], request);
    const { id: listId } = await params;
    const { searchParams } = new URL(request.url);

    const sdrIds = searchParams.getAll('sdrIds[]');

    const health = await computeListHealth(listId, { sdrIds: sdrIds.length > 0 ? sdrIds : undefined });

    if (!health) {
        throw new NotFoundError('Liste introuvable');
    }

    return successResponse(health);
});
