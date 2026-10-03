import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============================================
// GET /api/analytics/daily-activity
// Returns daily activity hours for team members in a date range
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

        const { searchParams } = new URL(request.url);
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");
        const userIdsParam = searchParams.get("userIds");

        if (!startDateParam || !endDateParam) {
            return NextResponse.json(
                { success: false, error: "startDate and endDate required" },
                { status: 400 }
            );
        }

        // Parse dates in local timezone
        const [startYear, startMonth, startDay] = startDateParam.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDateParam.split('-').map(Number);

        const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

        const userIds = userIdsParam ? userIdsParam.split(",").filter(Boolean) : [];

        // Build where clause
        const where: any = {
            date: {
                gte: startDate,
                lte: endDate,
            },
        };

        if (userIds.length > 0) {
            where.userId = { in: userIds };
        } else {
            // Default: only SDRs and BDs
            where.user = {
                role: {
                    in: ["SDR", "BUSINESS_DEVELOPER"],
                },
            };
        }

        // Fetch activity data
        const activities = await prisma.crmActivityDay.findMany({
            where,
            select: {
                userId: true,
                date: true,
                totalActiveSeconds: true,
            },
            orderBy: [
                { userId: 'asc' },
                { date: 'asc' },
            ],
        });

        // Format response: { userId: { "YYYY-MM-DD": hours } }
        const result: Record<string, Record<string, number>> = {};

        for (const activity of activities) {
            if (!result[activity.userId]) {
                result[activity.userId] = {};
            }

            // Format date as YYYY-MM-DD in local timezone
            const dateStr = activity.date.toISOString().split('T')[0];
            const hours = Number((activity.totalActiveSeconds / 3600).toFixed(2));

            result[activity.userId][dateStr] = hours;
        }

        return NextResponse.json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error("[GET /api/analytics/daily-activity] Error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
