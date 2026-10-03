// ============================================
// AI ANALYSIS API ROUTE
// POST /api/email/ai/analyze - Analyze thread with AI
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailAIService } from '@/lib/email/services/ai-service';

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
        const { threadId, type } = body;

        if (!threadId) {
            return NextResponse.json(
                { success: false, error: 'Thread ID requis' },
                { status: 400 }
            );
        }

        // Verify thread access
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
                emails: {
                    select: {
                        bodyText: true,
                        fromAddress: true,
                        toAddresses: true,
                        receivedAt: true,
                    },
                    orderBy: { receivedAt: 'asc' },
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

        // Perform analysis based on type
        const lastEmail = thread.emails[thread.emails.length - 1];
        const allText = thread.emails.map(e => e.bodyText || '').join('\n---\n');

        switch (type) {
            case 'sentiment': {
                const sentiment = await emailAIService.analyzeSentiment(
                    lastEmail?.bodyText || allText
                );
                
                await prisma.emailThread.update({
                    where: { id: threadId },
                    data: { sentiment: sentiment.sentiment },
                });

                return NextResponse.json({
                    success: true,
                    data: { sentiment },
                });
            }

            case 'priority': {
                const priority = await emailAIService.classifyPriority(allText, {
                    isReply: thread.emails.length > 1,
                });
                
                await prisma.emailThread.update({
                    where: { id: threadId },
                    data: { priority: priority.priority },
                });

                return NextResponse.json({
                    success: true,
                    data: { priority },
                });
            }

            case 'summary': {
                const summary = await emailAIService.summarizeThread(
                    thread.emails.map(e => ({
                        from: e.fromAddress,
                        to: e.toAddresses,
                        body: e.bodyText || '',
                        date: e.receivedAt || new Date(),
                    }))
                );
                
                await prisma.emailThread.update({
                    where: { id: threadId },
                    data: { summary: summary.summary },
                });

                return NextResponse.json({
                    success: true,
                    data: { summary },
                });
            }

            case 'suggestions': {
                if (!lastEmail) {
                    return NextResponse.json(
                        { success: false, error: 'Aucun email à analyser' },
                        { status: 400 }
                    );
                }

                const suggestions = await emailAIService.generateReplySuggestions({
                    from: lastEmail.fromAddress,
                    subject: thread.subject,
                    body: lastEmail.bodyText || '',
                });

                return NextResponse.json({
                    success: true,
                    data: { suggestions },
                });
            }

            case 'all':
            default: {
                const analysis = await emailAIService.analyzeThread(threadId);
                return NextResponse.json({
                    success: true,
                    data: analysis,
                });
            }
        }
    } catch (error) {
        console.error('POST /api/email/ai/analyze error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
