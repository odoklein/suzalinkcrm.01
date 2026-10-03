import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireAuth,
    withErrorHandler,
} from '@/lib/api-utils';
import { listFiles, refreshTokenIfNeeded } from '@/lib/google-drive';

// ============================================
// GET /api/integrations/google-drive/files
// List files from Google Drive
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireAuth(request);

    try {
        const { searchParams } = new URL(request.url);
        const folderId = searchParams.get('folderId') || undefined;
        const pageToken = searchParams.get('pageToken') || undefined;

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

        // List files from Google Drive
        const result = await listFiles(refreshedTokens, folderId, pageToken);

        // Format files for frontend
        const formattedFiles = result.files.map((file: any) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size ? parseInt(file.size) : 0,
            formattedSize: formatFileSize(file.size ? parseInt(file.size) : 0),
            createdAt: file.createdTime,
            modifiedAt: file.modifiedTime,
            webViewLink: file.webViewLink,
            iconLink: file.iconLink,
            thumbnailLink: file.thumbnailLink,
            isFolder: file.mimeType === 'application/vnd.google-apps.folder',
            source: 'google_drive' as const,
        }));

        // Separate folders and files
        const folders = formattedFiles.filter((f: any) => f.isFolder);
        const files = formattedFiles.filter((f: any) => !f.isFolder);

        return successResponse({
            folders,
            files,
            nextPageToken: result.nextPageToken,
            total: formattedFiles.length,
        });
    } catch (error) {
        console.error('Google Drive files error:', error);
        return errorResponse('Échec de la récupération des fichiers Google Drive', 500);
    }
});

// Helper function to format file size
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
