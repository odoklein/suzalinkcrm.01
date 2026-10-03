import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireAuth,
    withErrorHandler,
} from '@/lib/api-utils';
import { uploadFile, refreshTokenIfNeeded } from '@/lib/google-drive';

// ============================================
// POST /api/integrations/google-drive/upload
// Upload file to Google Drive
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireAuth(request);

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const folderId = formData.get('folderId') as string | null;

        if (!file) {
            return errorResponse('Aucun fichier fourni', 400);
        }

        // Get user with Google Drive tokens
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                googleDriveConnected: true,
                googleDriveTokens: true,
            },
        });

        if (!user?.googleDriveConnected || !user?.googleDriveTokens) {
            return errorResponse('Google Drive non connecté', 401);
        }

        // Refresh token if needed
        const encryptedTokens = user.googleDriveTokens as string;
        const refreshedTokens = await refreshTokenIfNeeded(encryptedTokens);

        // Update tokens if refreshed
        if (refreshedTokens !== encryptedTokens) {
            await prisma.user.update({
                where: { id: session.user.id },
                data: { googleDriveTokens: refreshedTokens },
            });
        }

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload to Google Drive
        const result = await uploadFile(
            refreshedTokens,
            {
                name: file.name,
                mimeType: file.type,
                buffer,
            },
            folderId || undefined
        );

        return successResponse({
            id: result.id,
            name: result.name,
            mimeType: result.mimeType,
            size: result.size,
            webViewLink: result.webViewLink,
            source: 'google_drive',
        }, 201);
    } catch (error) {
        console.error('Google Drive upload error:', error);
        return errorResponse('Échec du téléchargement vers Google Drive', 500);
    }
});
