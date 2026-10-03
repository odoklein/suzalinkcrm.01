// ============================================
// EMAIL HUB — DASHBOARD ACTIVITY FEED API
// GET /api/email/dashboard/activity
// Today's chronological email events
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

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "20");

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get today's emails with tracking events
        const emails = await prisma.email.findMany({
            where: {
                OR: [
                    { sentAt: { gte: today } },
                    { firstOpenedAt: { gte: today } },
                    { updatedAt: { gte: today }, status: { in: ["REPLIED", "BOUNCED", "CLICKED"] } },
                ],
            },
            include: {
                contact: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        company: {
                            select: { name: true },
                        },
                    },
                },
                mission: {
                    select: { id: true, name: true },
                },
                thread: {
                    select: { id: true, subject: true },
                },
                sequenceStep: {
                    select: {
                        order: true,
                        name: true,
                        sequence: {
                            select: { name: true },
                        },
                    },
                },
                mailbox: {
                    select: { email: true },
                },
            },
            orderBy: { updatedAt: "desc" },
            take: limit * 2, // Fetch more to generate multiple events per email
        });

        // Transform emails into activity events
        type ActivityEvent = {
            id: string;
            type: "sent" | "opened" | "replied" | "clicked" | "bounced" | "sequence_step";
            timestamp: string;
            contactName: string | null;
            companyName: string | null;
            contactId: string | null;
            threadId: string | null;
            subject: string;
            missionName: string | null;
            sequenceName: string | null;
            mailboxEmail: string | null;
            openCount?: number;
            meta?: string;
        };

        const events: ActivityEvent[] = [];

        for (const email of emails) {
            const contactName = email.contact
                ? [email.contact.firstName, email.contact.lastName].filter(Boolean).join(" ") || null
                : null;
            const companyName = email.contact?.company?.name || null;

            // Replied event (highest priority)
            if (email.status === "REPLIED") {
                events.push({
                    id: `${email.id}-replied`,
                    type: "replied",
                    timestamp: email.updatedAt.toISOString(),
                    contactName,
                    companyName,
                    contactId: email.contactId,
                    threadId: email.threadId,
                    subject: email.subject,
                    missionName: email.mission?.name || null,
                    sequenceName: email.sequenceStep?.sequence?.name || null,
                    mailboxEmail: email.mailbox.email,
                });
            }

            // Bounced event
            if (email.status === "BOUNCED") {
                events.push({
                    id: `${email.id}-bounced`,
                    type: "bounced",
                    timestamp: email.updatedAt.toISOString(),
                    contactName,
                    companyName,
                    contactId: email.contactId,
                    threadId: email.threadId,
                    subject: email.subject,
                    missionName: email.mission?.name || null,
                    sequenceName: email.sequenceStep?.sequence?.name || null,
                    mailboxEmail: email.mailbox.email,
                });
            }

            // Opened event
            if (email.firstOpenedAt && email.firstOpenedAt >= today) {
                events.push({
                    id: `${email.id}-opened`,
                    type: "opened",
                    timestamp: (email.lastOpenedAt || email.firstOpenedAt).toISOString(),
                    contactName,
                    companyName,
                    contactId: email.contactId,
                    threadId: email.threadId,
                    subject: email.subject,
                    missionName: email.mission?.name || null,
                    sequenceName: email.sequenceStep?.sequence?.name || null,
                    mailboxEmail: email.mailbox.email,
                    openCount: email.openCount,
                });
            }

            // Sent event
            if (email.sentAt && email.sentAt >= today && email.direction === "OUTBOUND") {
                const isSequenceSend = !!email.sequenceStep;
                events.push({
                    id: `${email.id}-sent`,
                    type: isSequenceSend ? "sequence_step" : "sent",
                    timestamp: email.sentAt.toISOString(),
                    contactName,
                    companyName,
                    contactId: email.contactId,
                    threadId: email.threadId,
                    subject: email.subject,
                    missionName: email.mission?.name || null,
                    sequenceName: email.sequenceStep?.sequence?.name || null,
                    mailboxEmail: email.mailbox.email,
                    meta: isSequenceSend
                        ? `Étape ${email.sequenceStep!.order + 1}`
                        : undefined,
                });
            }
        }

        // Sort by timestamp descending and limit
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return NextResponse.json({
            success: true,
            data: events.slice(0, limit),
        });
    } catch (error) {
        console.error("[Email Dashboard Activity]", error);
        return NextResponse.json(
            { error: "Failed to fetch activity feed" },
            { status: 500 }
        );
    }
}
