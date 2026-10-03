import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireAuth,
  withErrorHandler,
  validateRequest,
} from "@/lib/api-utils";
import {
  downloadFile,
  getFile,
  refreshTokenIfNeeded,
} from "@/lib/google-drive";
import { storageService } from "@/lib/storage/storage-service";
import { z } from "zod";

const importSchema = z.object({
  driveFileId: z.string(),
  crmFolderId: z.string().optional(),
});

// ============================================
// POST /api/integrations/google-drive/import
// Import file from Google Drive to CRM
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);

  try {
    const data = await validateRequest(request, importSchema);

    // Get user with Google Drive tokens
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        googleDriveConnected: true,
        googleDriveTokens: true,
      },
    });

    if (!user?.googleDriveConnected || !user?.googleDriveTokens) {
      return errorResponse("Google Drive non connecté", 401);
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

    // Get file metadata from Google Drive
    const fileMetadata = await getFile(refreshedTokens, data.driveFileId);

    if (!fileMetadata || !fileMetadata.name) {
      return errorResponse("Fichier non trouvé sur Google Drive", 404);
    }

    // Check if it's a folder (can't import folders)
    if (fileMetadata.mimeType === "application/vnd.google-apps.folder") {
      return errorResponse("Impossible d'importer un dossier", 400);
    }

    // Download file from Google Drive (or export if Google Doc)
    const { buffer: fileBuffer, mimeType: finalMimeType } = await downloadFile(
      refreshedTokens,
      data.driveFileId,
      fileMetadata.mimeType || undefined,
    );

    let finalName = fileMetadata.name;
    // If we converted to PDF, ensure name ends in .pdf
    if (
      finalMimeType === "application/pdf" &&
      !finalName.toLowerCase().endsWith(".pdf")
    ) {
      finalName += ".pdf";
    }

    // Upload to CRM storage
    const { key, url } = await storageService.upload(
      fileBuffer,
      {
        filename: finalName,
        mimeType: finalMimeType,
        size: fileBuffer.length,
        folder: "imported",
      },
      session.user.id,
    );

    // Save to database
    const fileRecord = await prisma.file.create({
      data: {
        name: finalName.replace(/\.[^/.]+$/, ""),
        originalName: finalName,
        mimeType: finalMimeType,
        size: fileBuffer.length,
        path: key,
        url,
        uploadedById: session.user.id,
        folderId: data.crmFolderId || undefined,
        description: `Importé depuis Google Drive`,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return successResponse(
      {
        ...fileRecord,
        formattedSize: storageService.formatSize(fileBuffer.length),
        importedFrom: "google_drive",
      },
      201,
    );
  } catch (error) {
    console.error("Google Drive import error:", error);
    return errorResponse("Échec de l'importation depuis Google Drive", 500);
  }
});
