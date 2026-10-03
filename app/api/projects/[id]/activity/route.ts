import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/projects/[id]/activity - Activity feed
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "30");
        const actionFilter = searchParams.get("action"); // filter by action type

        const whereClause: any = { projectId: id };
        if (actionFilter) {
            whereClause.action = actionFilter;
        }

        const [activities, total] = await Promise.all([
            prisma.projectActivity.findMany({
                where: whereClause,
                include: {
                    user: { select: { id: true, name: true } },
                    task: { select: { id: true, title: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.projectActivity.count({ where: whereClause }),
        ]);

        return NextResponse.json({
            success: true,
            data: activities,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error("GET /api/projects/[id]/activity error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
