import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireAuth,
    withErrorHandler,
} from '@/lib/api-utils';

// ============================================
// POST /api/integrations/google-drive/disconnect
// Disconnect Google Drive from user account
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireAuth(request);

    try {
        // Update user record - remove Google Drive connection
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                googleDriveConnected: false,
                googleDriveTokens: undefined,
                googleDriveEmail: null,
            },
        });

        // Optionally: Deactivate all sync configurations
        await prisma.googleDriveSync.updateMany({
            where: { userId: session.user.id },
            data: { isActive: false },
        });

        return successResponse({
            message: 'Google Drive disconnected successfully',
        });
    } catch (error) {
        console.error('Google Drive disconnect error:', error);
        return errorResponse('Failed to disconnect Google Drive', 500);
    }
});
