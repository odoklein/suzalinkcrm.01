// ============================================
// EMAIL HUB — DASHBOARD PENDING ACTIONS API
// GET /api/email/dashboard/actions
// Items requiring human attention
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

        const actions: Array<{
            id: string;
            type: "reply" | "bounce" | "review" | "limit";
            priority: number;
            title: string;
            description: string;
            missionName: string | null;
            linkHref: string;
            linkLabel: string;
            count?: number;
            meta?: Record<string, unknown>;
        }> = [];

        // 1. Unread replies — threads with replies that haven't been read
        const unreadReplies = await prisma.emailThread.findMany({
            where: {
                isRead: false,
                emails: {
                    some: {
                        direction: "INBOUND",
                    },
                },
            },
            include: {
                contact: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
                mission: {
                    select: { name: true },
                },
            },
            take: 5,
            orderBy: { lastEmailAt: "desc" },
        });

        for (const thread of unreadReplies) {
            const contactName = thread.contact
                ? [thread.contact.firstName, thread.contact.lastName].filter(Boolean).join(" ")
                : "Contact";
            actions.push({
                id: `reply-${thread.id}`,
                type: "reply",
                priority: 1,
                title: `${contactName} a répondu`,
                description: `Réponse à "${thread.subject}"`,
                missionName: thread.mission?.name || null,
                linkHref: `/manager/email?threadId=${thread.id}`,
                linkLabel: "Ouvrir le fil →",
            });
        }

        // 2. Bounces — group by mailbox
        const bouncedEmails = await prisma.email.groupBy({
            by: ["mailboxId"],
            where: {
                status: "BOUNCED",
                updatedAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
                },
            },
            _count: true,
        });

        if (bouncedEmails.length > 0) {
            const mailboxes = await prisma.mailbox.findMany({
                where: {
                    id: { in: bouncedEmails.map((b) => b.mailboxId) },
                },
                select: { id: true, email: true },
            });

            for (const bounce of bouncedEmails) {
                const mailbox = mailboxes.find((m) => m.id === bounce.mailboxId);
                if (bounce._count >= 2) {
                    actions.push({
                        id: `bounce-${bounce.mailboxId}`,
                        type: "bounce",
                        priority: 2,
                        title: `${bounce._count} rebonds`,
                        description: `Hard bounces sur ${mailbox?.email || "boîte mail"}`,
                        missionName: null,
                        linkHref: `/manager/emails/mailboxes`,
                        linkLabel: "Vérifier →",
                        count: bounce._count,
                    });
                }
            }
        }

        // 3. Stuck enrollments — contacts that haven't opened after step 3
        const stuckEnrollments = await prisma.emailSequenceEnrollment.count({
            where: {
                status: "ACTIVE",
                currentStep: { gte: 3 },
                sequence: {
                    status: "ACTIVE",
                },
            },
        });

        if (stuckEnrollments > 0) {
            actions.push({
                id: "review-stuck",
                type: "review",
                priority: 3,
                title: `${stuckEnrollments} contacts bloqués`,
                description: `Contacts sans ouverture après l'étape 3 dans une séquence active`,
                missionName: null,
                linkHref: `/manager/emails/sequences`,
                linkLabel: "Prendre une action →",
                count: stuckEnrollments,
            });
        }

        // 4. Mailboxes near limit (>90% of daily limit)
        const nearLimitMailboxes = await prisma.mailbox.findMany({
            where: {
                isActive: true,
                // We can't do computed column filter in Prisma, so filter in JS
            },
            select: {
                id: true,
                email: true,
                sentToday: true,
                dailySendLimit: true,
            },
        });

        for (const mb of nearLimitMailboxes) {
            const ratio = mb.dailySendLimit > 0 ? mb.sentToday / mb.dailySendLimit : 0;
            if (ratio >= 0.9) {
                actions.push({
                    id: `limit-${mb.id}`,
                    type: "limit",
                    priority: 4,
                    title: `Limite d'envoi atteinte`,
                    description: `${mb.email} : ${mb.sentToday}/${mb.dailySendLimit} emails envoyés`,
                    missionName: null,
                    linkHref: `/manager/emails/mailboxes`,
                    linkLabel: "Ajuster →",
                    meta: {
                        sent: mb.sentToday,
                        limit: mb.dailySendLimit,
                        ratio: Math.round(ratio * 100),
                    },
                });
            }
        }

        // Sort by priority
        actions.sort((a, b) => a.priority - b.priority);

        return NextResponse.json({
            success: true,
            data: actions,
        });
    } catch (error) {
        console.error("[Email Dashboard Actions]", error);
        return NextResponse.json(
            { error: "Failed to fetch pending actions" },
            { status: 500 }
        );
    }
}
