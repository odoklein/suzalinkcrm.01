// ============================================
// SINGLE THREAD API ROUTES
// GET /api/email/threads/[id] - Get thread with messages
// PATCH /api/email/threads/[id] - Update thread
// DELETE /api/email/threads/[id] - Delete/trash thread
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ============================================
// GET - Get thread with all messages
// ============================================

export async function GET(
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

        // Get thread with full details
        const thread = await prisma.emailThread.findUnique({
            where: { id },
            include: {
                mailbox: {
                    select: {
                        id: true,
                        ownerId: true,
                        email: true,
                        displayName: true,
                        provider: true,
                        signature: true,
                        signatureHtml: true,
                        permissions: {
                            where: { userId: session.user.id },
                            select: {
                                canRead: true,
                                canSend: true,
                                canSendAs: true,
                            },
                        },
                    },
                },
                emails: {
                    orderBy: { receivedAt: 'asc' },
                    include: {
                        attachments: true,
                    },
                },
                comments: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        industry: true,
                    },
                },
                mission: {
                    select: {
                        id: true,
                        name: true,
                        client: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                campaign: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                contact: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        title: true,
                        company: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                opportunity: {
                    select: {
                        id: true,
                        needSummary: true,
                        urgency: true,
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

        // Check access
        const isOwner = thread.mailbox.ownerId === session.user.id;
        const hasPermission = thread.mailbox.permissions.some(p => p.canRead);
        const isManager = session.user.role === 'MANAGER';

        if (!isOwner && !hasPermission && !isManager) {
            return NextResponse.json(
                { success: false, error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        // Mark as read if unread
        if (!thread.isRead) {
            await prisma.emailThread.update({
                where: { id },
                data: { isRead: true },
            });
        }

        // Build permissions for the user
        const permissions = {
            canRead: true,
            canSend: isOwner || thread.mailbox.permissions.some(p => p.canSend),
            canSendAs: isOwner || thread.mailbox.permissions.some(p => p.canSendAs),
        };

        return NextResponse.json({
            success: true,
            data: {
                ...thread,
                permissions,
            },
        });
    } catch (error) {
        console.error('GET /api/email/threads/[id] error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// ============================================
// PATCH - Update thread
// ============================================

export async function PATCH(
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
        const body = await req.json();

        // Get thread with mailbox
        const thread = await prisma.emailThread.findUnique({
            where: { id },
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

        // Check access
        const isOwner = thread.mailbox.ownerId === session.user.id;
        const hasPermission = thread.mailbox.permissions.some(p => p.canRead);
        const isManager = session.user.role === 'MANAGER';

        if (!isOwner && !hasPermission && !isManager) {
            return NextResponse.json(
                { success: false, error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        // Build update data
        const updateData: Record<string, unknown> = {};

        if (typeof body.isRead === 'boolean') {
            updateData.isRead = body.isRead;
        }
        if (typeof body.isStarred === 'boolean') {
            updateData.isStarred = body.isStarred;
        }
        if (typeof body.isArchived === 'boolean') {
            updateData.isArchived = body.isArchived;
        }
        if (typeof body.isTrashed === 'boolean') {
            updateData.isTrashed = body.isTrashed;
        }
        if (body.assignedToId !== undefined) {
            updateData.assignedToId = body.assignedToId || null;
        }
        if (body.labels !== undefined && Array.isArray(body.labels)) {
            updateData.labels = body.labels;
        }
        if (body.slaDeadline !== undefined) {
            updateData.slaDeadline = body.slaDeadline ? new Date(body.slaDeadline) : null;
        }

        // Update thread
        const updated = await prisma.emailThread.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                isRead: true,
                isStarred: true,
                isArchived: true,
                isTrashed: true,
                labels: true,
                assignedToId: true,
                slaDeadline: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: updated,
        });
    } catch (error) {
        console.error('PATCH /api/email/threads/[id] error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// ============================================
// DELETE - Delete/trash thread
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

        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const permanent = searchParams.get('permanent') === 'true';

        // Get thread with mailbox
        const thread = await prisma.emailThread.findUnique({
            where: { id },
            include: {
                mailbox: {
                    select: {
                        ownerId: true,
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

        // Only owner or manager can delete
        if (thread.mailbox.ownerId !== session.user.id && session.user.role !== 'MANAGER') {
            return NextResponse.json(
                { success: false, error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        if (permanent) {
            // Permanently delete
            await prisma.emailThread.delete({
                where: { id },
            });

            return NextResponse.json({
                success: true,
                message: 'Thread supprimé définitivement',
            });
        } else {
            // Move to trash
            await prisma.emailThread.update({
                where: { id },
                data: { isTrashed: true },
            });

            return NextResponse.json({
                success: true,
                message: 'Thread déplacé vers la corbeille',
            });
        }
    } catch (error) {
        console.error('DELETE /api/email/threads/[id] error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
