// ============================================
// SEQUENCE ENROLLMENT API ROUTES
// POST /api/email/sequences/[id]/enroll - Enroll contacts
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sequenceService } from '@/lib/email/services/sequence-service';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non autorisé' },
                { status: 401 }
            );
        }

        const { id: sequenceId } = await params;
        const body = await req.json();
        const { contactIds, tokens } = body;

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Liste de contacts requise' },
                { status: 400 }
            );
        }

        // Verify sequence exists and user has access
        const sequence = await prisma.emailSequence.findUnique({
            where: { id: sequenceId },
            select: { createdById: true, status: true },
        });

        if (!sequence) {
            return NextResponse.json(
                { success: false, error: 'Séquence non trouvée' },
                { status: 404 }
            );
        }

        if (sequence.createdById !== session.user.id && session.user.role !== 'MANAGER') {
            return NextResponse.json(
                { success: false, error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        if (sequence.status !== 'ACTIVE') {
            return NextResponse.json(
                { success: false, error: 'Séquence non active' },
                { status: 400 }
            );
        }

        // Enroll contacts
        const results: {
            contactId: string;
            success: boolean;
            enrollmentId?: string;
            error?: string;
        }[] = [];

        for (const contactId of contactIds) {
            const result = await sequenceService.enrollContact({
                sequenceId,
                contactId,
                tokens,
            });

            results.push({
                contactId,
                ...result,
            });
        }

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        return NextResponse.json({
            success: true,
            data: {
                enrolled: successful.length,
                failed: failed.length,
                results,
            },
        });
    } catch (error) {
        console.error('POST /api/email/sequences/[id]/enroll error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
