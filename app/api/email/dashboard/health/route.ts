// ============================================
// EMAIL HUB — DASHBOARD HEALTH API
// GET /api/email/dashboard/health
// Returns health pulse metrics for the top strip
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Run all queries in parallel
        const [
            activeMailboxes,
            warmingMailboxes,
            sentToday,
            todayAnalytics,
            activeSequences,
            errorMailboxes,
        ] = await Promise.all([
            // Active & synced mailboxes
            prisma.mailbox.count({
                where: {
                    isActive: true,
                    syncStatus: "SYNCED",
                },
            }),

            // Warming up mailboxes
            prisma.mailbox.count({
                where: {
                    isActive: true,
                    warmupStatus: "IN_PROGRESS",
                },
            }),

            // Emails sent today
            prisma.email.count({
                where: {
                    direction: "OUTBOUND",
                    sentAt: { gte: today },
                    status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
                },
            }),

            // Today's analytics (aggregated)
            prisma.emailAnalyticsDaily.aggregate({
                where: {
                    date: {
                        gte: today,
                    },
                },
                _sum: {
                    sent: true,
                    opened: true,
                    uniqueOpened: true,
                    clicked: true,
                    replied: true,
                    bounced: true,
                },
            }),

            // Active sequences
            prisma.emailSequence.count({
                where: {
                    status: "ACTIVE",
                },
            }),

            // Mailboxes with errors
            prisma.mailbox.count({
                where: {
                    OR: [
                        { syncStatus: "ERROR" },
                        { disabledAt: { not: null } },
                    ],
                },
            }),
        ]);

        const totalSent = todayAnalytics._sum.sent || sentToday || 0;
        const totalOpened = todayAnalytics._sum.uniqueOpened || todayAnalytics._sum.opened || 0;
        const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 1000) / 10 : 0;

        return NextResponse.json({
            success: true,
            data: {
                activeMailboxes,
                warmingMailboxes,
                sentToday: totalSent || sentToday,
                openRate,
                activeSequences,
                errorMailboxes,
                // Extra aggregate details
                totalReplied: todayAnalytics._sum.replied || 0,
                totalBounced: todayAnalytics._sum.bounced || 0,
                totalClicked: todayAnalytics._sum.clicked || 0,
            },
        });
    } catch (error) {
        console.error("[Email Dashboard Health]", error);
        return NextResponse.json(
            { error: "Failed to fetch health metrics" },
            { status: 500 }
        );
    }
}
