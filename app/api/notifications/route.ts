import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/notifications
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const notifications = await prisma.notification.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" },
            take: 50, // Limit to last 50
        });

        const unreadCount = await prisma.notification.count({
            where: { userId: session.user.id, isRead: false },
        });

        return NextResponse.json({ success: true, data: { notifications, unreadCount } });
    } catch (error: unknown) {
        const prismaError = error as { code?: string };
        if (prismaError?.code === "P1001" || prismaError?.code === "P1017") {
            // Database unreachable - return empty to avoid breaking the UI
            console.warn("Database unreachable, returning empty notifications:", prismaError?.code);
            return NextResponse.json({ success: true, data: { notifications: [], unreadCount: 0 } });
        }
        console.error("GET /api/notifications error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// PATCH /api/notifications - Mark all as read
export async function PATCH(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        await prisma.notification.updateMany({
            where: { userId: session.user.id, isRead: false },
            data: { isRead: true },
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const prismaError = error as { code?: string };
        if (prismaError?.code === "P1001" || prismaError?.code === "P1017") {
            console.warn("Database unreachable:", prismaError?.code);
            return NextResponse.json({ success: true });
        }
        console.error("PATCH /api/notifications error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
