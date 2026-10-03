import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMeetingReminderNotification } from "@/lib/notifications";

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const upcomingMeetings = await prisma.action.findMany({
            where: {
                result: "MEETING_BOOKED",
                callbackDate: { gte: now, lte: in24h },
            },
            include: {
                contact: {
                    include: { company: { select: { name: true } } },
                },
                campaign: {
                    include: {
                        mission: {
                            include: { client: { select: { id: true } } },
                        },
                    },
                },
            },
        });

        let sent = 0;
        for (const meeting of upcomingMeetings) {
            const clientId = meeting.campaign.mission.client.id;

            const existingReminder = await prisma.notification.findFirst({
                where: {
                    link: "/client/portal/meetings",
                    title: { startsWith: "Rappel" },
                    createdAt: { gte: new Date(now.getTime() - 25 * 60 * 60 * 1000) },
                    message: { contains: meeting.contact?.lastName || meeting.id },
                    user: { clientId },
                },
            });

            if (existingReminder) continue;

            const hoursUntil = Math.round((new Date(meeting.callbackDate!).getTime() - now.getTime()) / 3600000);
            const timeLabel = hoursUntil <= 2 ? "dans 1h" : "demain";

            await createMeetingReminderNotification(
                clientId,
                {
                    contactFirstName: meeting.contact?.firstName,
                    contactLastName: meeting.contact?.lastName,
                    contactTitle: meeting.contact?.title,
                    companyName: meeting.contact?.company?.name || "Entreprise",
                    sdrNote: meeting.note,
                },
                timeLabel
            );
            sent++;
        }

        return NextResponse.json({
            success: true,
            checked: upcomingMeetings.length,
            sent,
        });
    } catch (error) {
        console.error("Meeting reminder cron error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
