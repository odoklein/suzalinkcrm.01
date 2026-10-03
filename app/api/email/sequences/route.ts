// ============================================
// SEQUENCES API ROUTES
// GET /api/email/sequences - List sequences
// POST /api/email/sequences - Create sequence
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SequenceStatus } from '@prisma/client';

// ============================================
// GET - List sequences
// ============================================

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non autorisé' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const mailboxId = searchParams.get('mailboxId');
        const status = searchParams.get('status') as SequenceStatus | null;
        const campaignId = searchParams.get('campaignId');

        // Build where clause
        const where: any = {
            createdById: session.user.id,
        };

        // Manager can see all sequences
        if (session.user.role === 'MANAGER') {
            delete where.createdById;
        }

        if (mailboxId) where.mailboxId = mailboxId;
        if (status) where.status = status;
        if (campaignId) where.campaignId = campaignId;

        const sequences = await prisma.emailSequence.findMany({
            where,
            include: {
                mailbox: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                    },
                },
                campaign: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                _count: {
                    select: {
                        steps: true,
                        enrollments: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            success: true,
            data: sequences,
        });
    } catch (error) {
        console.error('GET /api/email/sequences error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// ============================================
// POST - Create sequence
// ============================================

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non autorisé' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const {
            name,
            description,
            mailboxId,
            campaignId,
            stopOnReply = true,
            stopOnBounce = true,
            sendOnWeekends = false,
            sendTimeStart,
            sendTimeEnd,
            steps = [],
        } = body;

        // Validate required fields
        if (!name?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Nom requis' },
                { status: 400 }
            );
        }

        if (!mailboxId) {
            return NextResponse.json(
                { success: false, error: 'Mailbox requis' },
                { status: 400 }
            );
        }

        // Verify mailbox access
        const mailbox = await prisma.mailbox.findFirst({
            where: {
                id: mailboxId,
                OR: [
                    { ownerId: session.user.id },
                    { permissions: { some: { userId: session.user.id, canSend: true } } },
                ],
            },
        });

        if (!mailbox && session.user.role !== 'MANAGER') {
            return NextResponse.json(
                { success: false, error: 'Accès mailbox non autorisé' },
                { status: 403 }
            );
        }

        // Create sequence with steps
        const sequence = await prisma.emailSequence.create({
            data: {
                name: name.trim(),
                description: description?.trim(),
                mailboxId,
                campaignId: campaignId || null,
                createdById: session.user.id,
                status: 'DRAFT',
                stopOnReply,
                stopOnBounce,
                sendOnWeekends,
                sendTimeStart: sendTimeStart || null,
                sendTimeEnd: sendTimeEnd || null,
                steps: {
                    create: steps.map((step: {
                        subject: string;
                        bodyHtml: string;
                        bodyText?: string;
                        delayDays?: number;
                        delayHours?: number;
                        delayMinutes?: number;
                        skipIfOpened?: boolean;
                        skipIfClicked?: boolean;
                    }, index: number) => ({
                        order: index,
                        subject: step.subject,
                        bodyHtml: step.bodyHtml,
                        bodyText: step.bodyText || null,
                        delayDays: step.delayDays || 0,
                        delayHours: step.delayHours || 0,
                        delayMinutes: step.delayMinutes || 0,
                        skipIfOpened: step.skipIfOpened || false,
                        skipIfClicked: step.skipIfClicked || false,
                    })),
                },
            },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
                mailbox: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: sequence,
        });
    } catch (error) {
        console.error('POST /api/email/sequences error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
