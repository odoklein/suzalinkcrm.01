import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireAuth,
    withErrorHandler,
} from '@/lib/api-utils';

// ============================================
// GET /api/integrations/google-drive/status
// Get Google Drive connection status
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireAuth(request);

    try {
        // Get user with Google Drive info
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                googleDriveConnected: true,
                googleDriveEmail: true,
                googleDriveSyncs: {
                    where: { isActive: true },
                    select: {
                        id: true,
                        driveFolderName: true,
                        syncDirection: true,
                        autoSync: true,
                        lastSyncedAt: true,
                        lastSyncStatus: true,
                        filesSync: true,
                        crmFolder: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            return errorResponse('User not found', 404);
        }

        return successResponse({
            connected: user.googleDriveConnected,
            email: user.googleDriveEmail,
            syncs: user.googleDriveSyncs,
            syncCount: user.googleDriveSyncs.length,
        });
    } catch (error) {
        console.error('Google Drive status error:', error);
        return errorResponse('Failed to get Google Drive status', 500);
    }
});
