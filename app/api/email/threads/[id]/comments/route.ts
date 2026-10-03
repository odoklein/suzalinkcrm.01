// ============================================
// THREAD COMMENTS API ROUTES
// GET /api/email/threads/[id]/comments - List comments
// POST /api/email/threads/[id]/comments - Add comment
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ============================================
// GET - List thread comments
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

        const { id: threadId } = await params;

        // Verify thread access
        const thread = await prisma.emailThread.findUnique({
            where: { id: threadId },
            select: {
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

        const comments = await prisma.threadComment.findMany({
            where: { threadId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        return NextResponse.json({
            success: true,
            data: comments,
        });
    } catch (error) {
        console.error('GET /api/email/threads/[id]/comments error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// ============================================
// POST - Add comment
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
        const { content } = body;

        if (!content?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Contenu requis' },
                { status: 400 }
            );
        }

        // Verify thread access
        const thread = await prisma.emailThread.findUnique({
            where: { id: threadId },
            select: {
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

        // Create comment
        const comment = await prisma.threadComment.create({
            data: {
                threadId,
                userId: session.user.id,
                content: content.trim(),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: comment,
        });
    } catch (error) {
        console.error('POST /api/email/threads/[id]/comments error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
