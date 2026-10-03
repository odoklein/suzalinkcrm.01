// ============================================
// EMAIL ANALYTICS API ROUTE
// GET /api/email/analytics - Get email analytics
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
        const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d
        const userId = searchParams.get('userId');

        // Calculate date range
        let daysBack = 30;
        switch (period) {
            case '7d': daysBack = 7; break;
            case '30d': daysBack = 30; break;
            case '90d': daysBack = 90; break;
        }
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        startDate.setHours(0, 0, 0, 0);

        // Build mailbox filter
        let mailboxIds: string[] = [];
        
        if (mailboxId) {
            mailboxIds = [mailboxId];
        } else {
            // Get accessible mailboxes
            const whereClause: Prisma.MailboxWhereInput = {
                isActive: true,
            };

            if (session.user.role !== 'MANAGER') {
                whereClause.OR = [
                    { ownerId: session.user.id },
                    { permissions: { some: { userId: session.user.id, canRead: true } } },
                ];
            } else if (userId) {
                whereClause.ownerId = userId;
            }

            const mailboxes = await prisma.mailbox.findMany({
                where: whereClause,
                select: { id: true },
            });
            mailboxIds = mailboxes.map(m => m.id);
        }

        if (mailboxIds.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    summary: { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 },
                    rates: { openRate: 0, clickRate: 0, replyRate: 0, bounceRate: 0 },
                    daily: [],
                    topPerformers: [],
                },
            });
        }

        // Get aggregated daily analytics
        const dailyAnalytics = await prisma.emailAnalyticsDaily.findMany({
            where: {
                mailboxId: { in: mailboxIds },
                date: { gte: startDate },
            },
            orderBy: { date: 'asc' },
        });

        // Aggregate totals
        const summary = {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            replied: 0,
            bounced: 0,
        };

        const dailyByDate = new Map<string, typeof summary>();

        for (const day of dailyAnalytics) {
            summary.sent += day.sent;
            summary.delivered += day.delivered;
            summary.opened += day.opened;
            summary.clicked += day.clicked;
            summary.replied += day.replied;
            summary.bounced += day.bounced;

            const dateKey = day.date.toISOString().split('T')[0];
            const existing = dailyByDate.get(dateKey) || { ...summary, sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 };
            
            dailyByDate.set(dateKey, {
                sent: existing.sent + day.sent,
                delivered: existing.delivered + day.delivered,
                opened: existing.opened + day.opened,
                clicked: existing.clicked + day.clicked,
                replied: existing.replied + day.replied,
                bounced: existing.bounced + day.bounced,
            });
        }

        // Calculate rates
        const rates = {
            openRate: summary.delivered > 0 ? (summary.opened / summary.delivered) * 100 : 0,
            clickRate: summary.opened > 0 ? (summary.clicked / summary.opened) * 100 : 0,
            replyRate: summary.delivered > 0 ? (summary.replied / summary.delivered) * 100 : 0,
            bounceRate: summary.sent > 0 ? (summary.bounced / summary.sent) * 100 : 0,
        };

        // Convert daily map to array
        const daily = Array.from(dailyByDate.entries()).map(([date, stats]) => ({
            date,
            ...stats,
        }));

        // Get top performing sequences
        const topSequences = await prisma.emailSequence.findMany({
            where: {
                mailboxId: { in: mailboxIds },
            },
            select: {
                id: true,
                name: true,
                totalEnrolled: true,
                totalCompleted: true,
                totalReplied: true,
                totalBounced: true,
            },
            orderBy: { totalReplied: 'desc' },
            take: 5,
        });

        // Get response time analytics (average time to first reply)
        const recentThreadsWithReply = await prisma.emailThread.findMany({
            where: {
                mailboxId: { in: mailboxIds },
                createdAt: { gte: startDate },
            },
            include: {
                emails: {
                    where: { direction: 'OUTBOUND' },
                    orderBy: { sentAt: 'asc' },
                    take: 1,
                },
            },
            take: 100,
        });

        let totalResponseTime = 0;
        let responseCount = 0;
        
        for (const thread of recentThreadsWithReply) {
            if (thread.emails.length > 0 && thread.emails[0].sentAt) {
                const responseTime = thread.emails[0].sentAt.getTime() - thread.createdAt.getTime();
                if (responseTime > 0) {
                    totalResponseTime += responseTime;
                    responseCount++;
                }
            }
        }

        const avgResponseTime = responseCount > 0 
            ? Math.round(totalResponseTime / responseCount / (1000 * 60)) // in minutes
            : 0;

        return NextResponse.json({
            success: true,
            data: {
                summary,
                rates: {
                    openRate: Math.round(rates.openRate * 10) / 10,
                    clickRate: Math.round(rates.clickRate * 10) / 10,
                    replyRate: Math.round(rates.replyRate * 10) / 10,
                    bounceRate: Math.round(rates.bounceRate * 10) / 10,
                },
                daily,
                topSequences,
                avgResponseTime,
                period,
                mailboxCount: mailboxIds.length,
            },
        });
    } catch (error) {
        console.error('GET /api/email/analytics error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
