import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
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

const createInterlocuteurSchema = z.object({
    firstName: z.string().min(1, 'Prénom requis'),
    lastName: z.string().min(1, 'Nom requis'),
    title: z.string().optional(),
    department: z.string().optional(),
    territory: z.string().optional(),
    emails: z.array(contactEntrySchema).optional().default([]),
    phones: z.array(contactEntrySchema).optional().default([]),
    bookingLinks: z.array(bookingLinkSchema).optional().default([]),
    notes: z.string().optional(),
    isActive: z.boolean().optional().default(true),
});

// GET /api/clients/[id]/interlocuteurs
export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'CLIENT'], request);
    const { id } = await params;

    const interlocuteurs = await prisma.clientInterlocuteur.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'asc' },
    });

    return successResponse(interlocuteurs);
});

// POST /api/clients/[id]/interlocuteurs
export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;
    const data = await validateRequest(request, createInterlocuteurSchema);

    const interlocuteur = await prisma.clientInterlocuteur.create({
        data: {
            clientId: id,
            firstName: data.firstName,
            lastName: data.lastName,
            title: data.title || null,
            department: data.department || null,
            territory: data.territory || null,
            emails: data.emails as unknown as any,
            phones: data.phones as unknown as any,
            bookingLinks: data.bookingLinks as unknown as any,
            notes: data.notes || null,
            isActive: data.isActive,
        },
    });

    return successResponse(interlocuteur, 201);
});
