// ============================================
// EMAIL HUB — DASHBOARD SEQUENCES API
// GET /api/email/dashboard/sequences
// Active sequence performance with 7-day sparkline data
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

        // Get active + paused sequences with step aggregation
        const sequences = await prisma.emailSequence.findMany({
            where: {
                status: { in: ["ACTIVE", "PAUSED"] },
            },
            include: {
                campaign: {
                    include: {
                        mission: {
                            select: { id: true, name: true },
                        },
                    },
                },
                mailbox: {
                    select: { id: true, email: true, displayName: true },
                },
                steps: {
                    select: {
                        totalSent: true,
                        totalOpened: true,
                        totalReplied: true,
                        totalBounced: true,
                    },
                },
                _count: {
                    select: {
                        enrollments: true,
                        steps: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
        });

        // Get 7-day sparkline data for each sequence
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const sparklineData = await Promise.all(
            sequences.map(async (seq) => {
                const dailySends = await prisma.email.groupBy({
                    by: ["sentAt"],
                    where: {
                        sequenceEnrollment: {
                            sequenceId: seq.id,
                        },
                        sentAt: { gte: sevenDaysAgo },
                        direction: "OUTBOUND",
                    },
                    _count: true,
                });

                // Build 7-day array
                const days: number[] = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    d.setHours(0, 0, 0, 0);
                    const nextD = new Date(d);
                    nextD.setDate(nextD.getDate() + 1);

                    const count = dailySends.filter((s) => {
                        if (!s.sentAt) return false;
                        const sentDate = new Date(s.sentAt);
                        return sentDate >= d && sentDate < nextD;
                    }).length;
                    days.push(count);
                }
                return { sequenceId: seq.id, sparkline: days };
            })
        );

        const result = sequences.map((seq) => {
            // Aggregate step stats
            const totalSent = seq.steps.reduce((sum, s) => sum + s.totalSent, 0);
            const totalOpened = seq.steps.reduce((sum, s) => sum + s.totalOpened, 0);
            const totalReplied = seq.steps.reduce((sum, s) => sum + s.totalReplied, 0);

            const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
            const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

            const sparkline = sparklineData.find((s) => s.sequenceId === seq.id)?.sparkline || [0, 0, 0, 0, 0, 0, 0];

            return {
                id: seq.id,
                name: seq.name,
                status: seq.status,
                mission: seq.campaign?.mission || null,
                enrolled: seq.totalEnrolled,
                openRate,
                replyRate,
                stepsCount: seq._count.steps,
                sparkline,
            };
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("[Email Dashboard Sequences]", error);
        return NextResponse.json(
            { error: "Failed to fetch sequence performance" },
            { status: 500 }
        );
    }
}
