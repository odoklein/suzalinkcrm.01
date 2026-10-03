// ============================================
// MAILBOX SYNC API ROUTE
// POST /api/email/mailboxes/[id]/sync - Trigger sync
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { emailSyncService } from '@/lib/email/services/sync-service';

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

        const { id } = await params;
        const body = await req.json().catch(() => ({}));

        // Get mailbox
        const mailbox = await prisma.mailbox.findUnique({
            where: { id },
            select: {
                id: true,
                ownerId: true,
                syncStatus: true,
                permissions: {
                    where: { userId: session.user.id },
                    select: { canRead: true },
                },
            },
        });

        if (!mailbox) {
            return NextResponse.json(
                { success: false, error: 'Boîte mail non trouvée' },
                { status: 404 }
            );
        }

        // Check access
        const hasAccess = mailbox.ownerId === session.user.id ||
            mailbox.permissions.some(p => p.canRead) ||
            session.user.role === 'MANAGER';

        if (!hasAccess) {
            return NextResponse.json(
                { success: false, error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        // Check if already syncing
        if (mailbox.syncStatus === 'SYNCING') {
            return NextResponse.json(
                { success: false, error: 'Synchronisation déjà en cours' },
                { status: 409 }
            );
        }

        // Parse options
        const options = {
            fullSync: body.fullSync === true,
            maxThreads: body.maxThreads || 100,
            since: body.since ? new Date(body.since) : undefined,
        };

        // Trigger sync
        const result = await emailSyncService.syncMailbox(id, options);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.errors.join(', ') || 'Échec de la synchronisation',
                    data: result,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                threadsProcessed: result.threadsProcessed,
                messagesProcessed: result.messagesProcessed,
                duration: result.duration,
                errors: result.errors,
            },
        });
    } catch (error) {
        console.error('POST /api/email/mailboxes/[id]/sync error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
