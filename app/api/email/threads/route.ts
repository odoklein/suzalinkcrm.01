// ============================================
// EMAIL THREADS API ROUTES
// GET /api/email/threads - List threads
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

        // Parse query parameters
        const mailboxId = searchParams.get('mailboxId');
        const folder = searchParams.get('folder') || 'inbox'; // inbox, sent, drafts, archive, trash, starred
        const isRead = searchParams.get('isRead');
        const isStarred = searchParams.get('isStarred');
        const assignedToId = searchParams.get('assignedToId');
        const clientId = searchParams.get('clientId');
        const missionId = searchParams.get('missionId');
        const campaignId = searchParams.get('campaignId');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
        const skip = (page - 1) * limit;

        // Build mailbox filter - get accessible mailboxes
        let mailboxIds: string[] = [];

        if (mailboxId) {
            // Verify access to specific mailbox
            const hasAccess = await prisma.mailbox.findFirst({
                where: {
                    id: mailboxId,
                    OR: [
                        { ownerId: session.user.id },
                        { permissions: { some: { userId: session.user.id, canRead: true } } },
                    ],
                },
            });

            if (!hasAccess && session.user.role !== 'MANAGER') {
                return NextResponse.json(
                    { success: false, error: 'Accès non autorisé' },
                    { status: 403 }
                );
            }

            mailboxIds = [mailboxId];
        } else {
            // Get all accessible mailboxes
            const ownedMailboxes = await prisma.mailbox.findMany({
                where: { ownerId: session.user.id, isActive: true },
                select: { id: true },
            });

            const permittedMailboxes = await prisma.mailboxPermission.findMany({
                where: { userId: session.user.id, canRead: true },
                select: { mailboxId: true },
            });

            mailboxIds = [
                ...ownedMailboxes.map(m => m.id),
                ...permittedMailboxes.map(p => p.mailboxId),
            ];
        }

        if (mailboxIds.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    threads: [],
                    total: 0,
                    page,
                    limit,
                    hasMore: false,
                },
            });
        }

        // Build where clause
        const where: any = {
            mailboxId: { in: mailboxIds },
        };

        // Folder filters
        switch (folder) {
            case 'inbox':
                // Inbox = threads with at least one INBOUND email, not archived/trashed
                where.isArchived = false;
                where.isTrashed = false;
                where.emails = { some: { direction: 'INBOUND' } };
                break;
            case 'sent':
                // Sent = threads with at least one OUTBOUND email
                where.isArchived = false;
                where.isTrashed = false;
                where.emails = { some: { direction: 'OUTBOUND' } };
                break;
            case 'drafts':
                where.emails = { some: { status: 'DRAFT' } };
                break;
            case 'archive':
                where.isArchived = true;
                where.isTrashed = false;
                break;
            case 'trash':
                where.isTrashed = true;
                break;
            case 'starred':
                where.isStarred = true;
                where.isTrashed = false;
                break;
            case 'unread':
                // Unread = unread threads with inbound emails
                where.isRead = false;
                where.isArchived = false;
                where.isTrashed = false;
                where.emails = { some: { direction: 'INBOUND' } };
                break;
            case 'all':
                // All = everything except trash (both inbound and outbound)
                where.isTrashed = false;
                break;
        }

        // Additional filters
        if (isRead !== null && isRead !== undefined) {
            where.isRead = isRead === 'true';
        }
        if (isStarred === 'true') {
            where.isStarred = true;
        }
        if (assignedToId) {
            where.assignedToId = assignedToId;
        }
        if (clientId) {
            where.clientId = clientId;
        }
        if (missionId) {
            where.missionId = missionId;
        }
        if (campaignId) {
            where.campaignId = campaignId;
        }

        // Search
        if (search) {
            where.OR = [
                { subject: { contains: search, mode: 'insensitive' } },
                { snippet: { contains: search, mode: 'insensitive' } },
                { participantEmails: { has: search.toLowerCase() } },
            ];
        }

        // Get threads with counts
        const [threads, total] = await Promise.all([
            prisma.emailThread.findMany({
                where,
                select: {
                    id: true,
                    mailboxId: true,
                    subject: true,
                    snippet: true,
                    participantEmails: true,
                    isRead: true,
                    isStarred: true,
                    isArchived: true,
                    labels: true,
                    sentiment: true,
                    priority: true,
                    slaDeadline: true,
                    lastEmailAt: true,
                    createdAt: true,
                    // CRM links
                    clientId: true,
                    missionId: true,
                    campaignId: true,
                    contactId: true,
                    opportunityId: true,
                    // Assignment
                    assignedToId: true,
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    // Mailbox info
                    mailbox: {
                        select: {
                            id: true,
                            email: true,
                            displayName: true,
                            provider: true,
                        },
                    },
                    // Email count and latest
                    _count: {
                        select: { emails: true },
                    },
                    emails: {
                        orderBy: { receivedAt: 'desc' },
                        take: 1,
                        select: {
                            id: true,
                            fromAddress: true,
                            fromName: true,
                            receivedAt: true,
                            direction: true,
                        },
                    },
                },
                orderBy: { lastEmailAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.emailThread.count({ where }),
        ]);

        // Transform threads
        const transformedThreads = threads.map(thread => ({
            ...thread,
            messageCount: thread._count.emails,
            latestEmail: thread.emails[0] || null,
            _count: undefined,
            emails: undefined,
        }));

        return NextResponse.json({
            success: true,
            data: {
                threads: transformedThreads,
                total,
                page,
                limit,
                hasMore: skip + threads.length < total,
            },
        });
    } catch (error) {
        console.error('GET /api/email/threads error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
