import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// PATCH /api/tasks/reorder - Reorder tasks (Kanban drag-and-drop)
export async function PATCH(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const body = await req.json();
        const { updates } = body;
        // updates: [{ id: string, position: number, status?: string }]

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return NextResponse.json({ success: false, error: "updates requis" }, { status: 400 });
        }

        // Use transaction for atomic reordering
        await prisma.$transaction(
            updates.map((u: { id: string; position: number; status?: string }) =>
                prisma.task.update({
                    where: { id: u.id },
                    data: {
                        position: u.position,
                        ...(u.status && { status: u.status as any }),
                        ...(u.status === "DONE" && { completedAt: new Date() }),
                        ...(u.status && u.status !== "DONE" && { completedAt: null }),
                    },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH /api/tasks/reorder error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
