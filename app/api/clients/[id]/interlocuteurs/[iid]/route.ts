import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    NotFoundError,
} from '@/lib/api-utils';
import { z } from 'zod';

const contactEntrySchema = z.object({
    value: z.string(),
    label: z.string(),
    isPrimary: z.boolean(),
});

const bookingLinkSchema = z.object({
    label: z.string(),
    url: z.string(),
    durationMinutes: z.number(),
});

const updateInterlocuteurSchema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    title: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    territory: z.string().nullable().optional(),
    emails: z.array(contactEntrySchema).optional(),
    phones: z.array(contactEntrySchema).optional(),
    bookingLinks: z.array(bookingLinkSchema).optional(),
    notes: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
});

// PUT /api/clients/[id]/interlocuteurs/[iid]
export const PUT = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; iid: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id, iid } = await params;
    const data = await validateRequest(request, updateInterlocuteurSchema);

    const existing = await prisma.clientInterlocuteur.findFirst({
        where: { id: iid, clientId: id },
    });

    if (!existing) {
        throw new NotFoundError('Interlocuteur introuvable');
    }

    const interlocuteur = await prisma.clientInterlocuteur.update({
        where: { id: iid },
        data: {
            ...(data.firstName !== undefined && { firstName: data.firstName }),
            ...(data.lastName !== undefined && { lastName: data.lastName }),
            ...(data.title !== undefined && { title: data.title || null }),
            ...(data.department !== undefined && { department: data.department || null }),
            ...(data.territory !== undefined && { territory: data.territory || null }),
            ...(data.emails !== undefined && { emails: data.emails as unknown as any }),
            ...(data.phones !== undefined && { phones: data.phones as unknown as any }),
            ...(data.bookingLinks !== undefined && { bookingLinks: data.bookingLinks as unknown as any }),
            ...(data.notes !== undefined && { notes: data.notes || null }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
    });

    return successResponse(interlocuteur);
});

// DELETE /api/clients/[id]/interlocuteurs/[iid]
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; iid: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id, iid } = await params;

    const existing = await prisma.clientInterlocuteur.findFirst({
        where: { id: iid, clientId: id },
    });

    if (!existing) {
        throw new NotFoundError('Interlocuteur introuvable');
    }

    await prisma.clientInterlocuteur.delete({
        where: { id: iid },
    });

    return successResponse({ deleted: true });
});
