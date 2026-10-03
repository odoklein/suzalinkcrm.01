// ============================================
// THREAD LINKING API ROUTES
// POST /api/email/threads/[id]/link - Link thread to CRM entity
// DELETE /api/email/threads/[id]/link - Unlink thread from CRM entity
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { crmLinkingService } from '@/lib/email/services/linking-service';

// ============================================
// POST - Link thread to CRM entity
// ============================================

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

        const { id: threadId } = await params;
        const body = await req.json();
        const { type, entityId, autoLink } = body;

        // Verify thread exists and user has access
        const thread = await prisma.emailThread.findUnique({
            where: { id: threadId },
            include: {
                mailbox: {
                    select: {
                        ownerId: true,
                        permissions: {
                            where: { userId: session.user.id },
                            select: { canRead: true },
                        },
                    },
                },
            },
        });

        if (!thread) {
            return NextResponse.json(
                { success: false, error: 'Thread non trouvé' },
                { status: 404 }
            );
        }

        const isOwner = thread.mailbox.ownerId === session.user.id;
        const hasPermission = thread.mailbox.permissions.some(p => p.canRead);

        if (!isOwner && !hasPermission && session.user.role !== 'MANAGER') {
            return NextResponse.json(
                { success: false, error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        // Auto-link if requested
        if (autoLink) {
            const result = await crmLinkingService.autoLinkThread(threadId);
            return NextResponse.json({
                success: true,
                data: result,
            });
        }

        // Manual link
        if (!type || !entityId) {
            return NextResponse.json(
                { success: false, error: 'Type et entityId requis' },
                { status: 400 }
            );
        }

        switch (type) {
            case 'client':
                await crmLinkingService.linkThreadToClient(threadId, entityId);
                break;
            case 'mission':
                await crmLinkingService.linkThreadToMission(threadId, entityId);
                break;
            case 'contact':
                await crmLinkingService.linkThreadToContact(threadId, entityId);
                break;
            case 'campaign':
                await crmLinkingService.linkThreadToCampaign(threadId, entityId);
                break;
            default:
                return NextResponse.json(
                    { success: false, error: 'Type de lien invalide' },
                    { status: 400 }
                );
        }

        // Get updated thread
        const updatedThread = await prisma.emailThread.findUnique({
            where: { id: threadId },
            select: {
                id: true,
                clientId: true,
                missionId: true,
                contactId: true,
                campaignId: true,
                opportunityId: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: updatedThread,
        });
    } catch (error) {
        console.error('POST /api/email/threads/[id]/link error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// ============================================
// DELETE - Unlink thread from CRM entity
// ============================================

export async function DELETE(
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

        const { id: threadId } = await params;
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') as 'client' | 'mission' | 'contact' | 'campaign' | 'opportunity' | null;

        if (!type) {
            return NextResponse.json(
                { success: false, error: 'Type requis' },
                { status: 400 }
            );
        }

        // Verify thread exists and user has access
        const thread = await prisma.emailThread.findUnique({
            where: { id: threadId },
            include: {
                mailbox: {
                    select: {
                        ownerId: true,
                        permissions: {
                            where: { userId: session.user.id },
                            select: { canRead: true },
                        },
                    },
                },
            },
        });

        if (!thread) {
            return NextResponse.json(
                { success: false, error: 'Thread non trouvé' },
                { status: 404 }
            );
        }

        const isOwner = thread.mailbox.ownerId === session.user.id;
        const hasPermission = thread.mailbox.permissions.some(p => p.canRead);

        if (!isOwner && !hasPermission && session.user.role !== 'MANAGER') {
            return NextResponse.json(
                { success: false, error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        await crmLinkingService.unlinkThread(threadId, type);

        return NextResponse.json({
            success: true,
            message: 'Lien supprimé',
        });
    } catch (error) {
        console.error('DELETE /api/email/threads/[id]/link error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
