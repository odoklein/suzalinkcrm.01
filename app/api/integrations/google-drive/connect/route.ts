import { NextRequest } from 'next/server';
import {
    successResponse,
    errorResponse,
    requireAuth,
    withErrorHandler,
} from '@/lib/api-utils';
import { getAuthUrl } from '@/lib/google-drive';

// ============================================
// POST /api/integrations/google-drive/connect
// Generate OAuth URL for Google Drive connection
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireAuth(request);

    try {
        // Generate state parameter for CSRF protection
        const state = JSON.stringify({
            userId: session.user.id,
            timestamp: Date.now(),
        });

        // Generate authorization URL
        const authUrl = getAuthUrl(Buffer.from(state).toString('base64'));

        return successResponse({
            authUrl,
            message: 'Redirect user to this URL to authorize Google Drive access',
        });
    } catch (error) {
        console.error('Google Drive connect error:', error);
        return errorResponse('Failed to generate authorization URL', 500);
    }
});
