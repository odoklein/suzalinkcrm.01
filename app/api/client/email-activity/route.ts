import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";

// ============================================
// GET /api/client/email-activity - Email stats for dashboard (CLIENT only)
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);

    const mailbox = await prisma.mailbox.findFirst({
        where: {
            ownerId: session.user.id,
            isActive: true,
        },
    });

    if (!mailbox) {
        return successResponse({
            connected: false,
            sentThisWeek: 0,
            opens: 0,
            replies: 0,
        });
    }

    // Last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const [sentCount, emailsWithOpens, replyCount] = await Promise.all([
        prisma.email.count({
            where: {
                mailboxId: mailbox.id,
                direction: "OUTBOUND",
                status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
                sentAt: { gte: weekAgo },
            },
        }),
        prisma.email.aggregate({
            where: {
                mailboxId: mailbox.id,
                direction: "OUTBOUND",
                sentAt: { gte: weekAgo },
            },
            _sum: { openCount: true },
        }),
        prisma.email.count({
            where: {
                mailboxId: mailbox.id,
                direction: "OUTBOUND",
                status: "REPLIED",
                sentAt: { gte: weekAgo },
            },
        }),
    ]);

    const opens = emailsWithOpens._sum.openCount ?? 0;

    return successResponse({
        connected: true,
        sentThisWeek: sentCount,
        opens,
        replies: replyCount,
    });
});
