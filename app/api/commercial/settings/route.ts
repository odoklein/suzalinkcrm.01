import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
    AuthError,
    ValidationError,
} from '@/lib/api-utils';

// ============================================
// GET /api/commercial/settings
// Get interlocuteur profile and booking links
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['COMMERCIAL'], request);

    const interlocuteurId = session.user.interlocuteurId;
    if (!interlocuteurId) {
        throw new AuthError('Profil commercial introuvable', 403);
    }

    const interlocuteur = await prisma.clientInterlocuteur.findUnique({
        where: { id: interlocuteurId },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            department: true,
            territory: true,
            emails: true,
            phones: true,
            bookingLinks: true,
            notes: true,
            isActive: true,
            client: { select: { id: true, name: true, logo: true } },
        },
    });

    if (!interlocuteur) {
        throw new AuthError('Interlocuteur introuvable', 403);
    }

    return successResponse(interlocuteur);
});

// ============================================
// PATCH /api/commercial/settings
// Update interlocuteur booking links and profile info
// ============================================

export const PATCH = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['COMMERCIAL'], request);

    const interlocuteurId = session.user.interlocuteurId;
    if (!interlocuteurId) {
        throw new AuthError('Profil commercial introuvable', 403);
    }

    const body = await request.json();
    const { title, department, territory, bookingLinks, notes } = body;

    // Validate bookingLinks structure if provided
    if (bookingLinks !== undefined) {
        if (!Array.isArray(bookingLinks)) {
            throw new ValidationError('bookingLinks doit être un tableau');
        }
        for (const link of bookingLinks) {
            if (!link.label || !link.url) {
                throw new ValidationError('Chaque lien doit avoir un label et une url');
            }
        }
    }

    const updated = await prisma.clientInterlocuteur.update({
        where: { id: interlocuteurId },
        data: {
            ...(title !== undefined && { title }),
            ...(department !== undefined && { department }),
            ...(territory !== undefined && { territory }),
            ...(bookingLinks !== undefined && { bookingLinks }),
            ...(notes !== undefined && { notes }),
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            department: true,
            territory: true,
            emails: true,
            phones: true,
            bookingLinks: true,
            notes: true,
        },
    });

    return successResponse(updated);
});
