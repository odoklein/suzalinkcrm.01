import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// PATCH /api/notifications/[id] - Mark single as read
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;

        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification || notification.userId !== session.user.id) {
            return NextResponse.json({ success: false, error: "Notification non trouvée" }, { status: 404 });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error("PATCH /api/notifications/[id] error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// DELETE /api/notifications/[id] - Delete a notification
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;

        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification || notification.userId !== session.user.id) {
            return NextResponse.json({ success: false, error: "Notification non trouvée" }, { status: 404 });
        }

        await prisma.notification.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/notifications/[id] error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
