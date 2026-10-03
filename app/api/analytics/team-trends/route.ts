import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============================================
// GET /api/analytics/team-trends
// Returns week-over-week comparison for team metrics
// ============================================

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        if (session.user.role !== "MANAGER") {
            return NextResponse.json(
                { success: false, error: "Réservé aux managers" },
                { status: 403 }
            );
        }

        // Get date ranges
        const now = new Date();
        const thisWeekStart = getWeekStart(now);
        const thisWeekEnd = getWeekEnd(now);
        const lastWeekStart = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
        const lastWeekEnd = getWeekEnd(new Date(now.getTime() - 7 * 24 * 60 * 1000));

        // Fetch this week's metrics
        const thisWeekMetrics = await getWeekMetrics(thisWeekStart, thisWeekEnd);

        // Fetch last week's metrics
        const lastWeekMetrics = await getWeekMetrics(lastWeekStart, lastWeekEnd);

        // Calculate changes
        const hoursChange = calculatePercentChange(
            thisWeekMetrics.totalHours,
            lastWeekMetrics.totalHours
        );
        const callsChange = calculatePercentChange(
            thisWeekMetrics.totalCalls,
            lastWeekMetrics.totalCalls
        );
        const meetingsChange = calculatePercentChange(
            thisWeekMetrics.totalMeetings,
            lastWeekMetrics.totalMeetings
        );

        return NextResponse.json({
            success: true,
            data: {
                hours: {
                    current: thisWeekMetrics.totalHours,
                    previous: lastWeekMetrics.totalHours,
                    change: Math.abs(hoursChange),
                    isPositive: hoursChange >= 0,
                },
                calls: {
                    current: thisWeekMetrics.totalCalls,
                    previous: lastWeekMetrics.totalCalls,
                    change: Math.abs(callsChange),
                    isPositive: callsChange >= 0,
                },
                meetings: {
                    current: thisWeekMetrics.totalMeetings,
                    previous: lastWeekMetrics.totalMeetings,
                    change: Math.abs(meetingsChange),
                    isPositive: meetingsChange >= 0,
                },
            },
        });

    } catch (error) {
        console.error("[GET /api/analytics/team-trends] Error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}

// Helper functions

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getWeekEnd(date: Date): Date {
    const d = getWeekStart(date);
    d.setDate(d.getDate() + 4); // Friday
    d.setHours(23, 59, 59, 999);
    return d;
}

async function getWeekMetrics(startDate: Date, endDate: Date) {
    // Get activity hours
    const activities = await prisma.crmActivityDay.findMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate,
            },
            user: {
                role: {
                    in: ["SDR", "BUSINESS_DEVELOPER"],
                },
            },
        },
        select: {
            totalActiveSeconds: true,
        },
    });

    const totalHours = activities.reduce(
        (sum, a) => sum + a.totalActiveSeconds / 3600,
        0
    );

    // Get actions (calls)
    const actions = await prisma.action.findMany({
        where: {
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
            sdr: {
                role: {
                    in: ["SDR", "BUSINESS_DEVELOPER"],
                },
            },
        },
        select: {
            result: true,
        },
    });

    const totalCalls = actions.length;
    const totalMeetings = actions.filter(
        (a) => a.result === "MEETING_BOOKED"
    ).length;

    return {
        totalHours,
        totalCalls,
        totalMeetings,
    };
}

function calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100);
}
