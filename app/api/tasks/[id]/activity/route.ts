import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/tasks/[id]/activity
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "30");

        const activities = await prisma.projectActivity.findMany({
            where: { taskId: id },
            include: {
                user: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return NextResponse.json({ success: true, data: activities });
    } catch (error) {
        console.error("GET /api/tasks/[id]/activity error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
