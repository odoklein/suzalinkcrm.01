import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/tasks/[id]/dependencies
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;

        const [dependentOn, blockedBy] = await Promise.all([
            prisma.taskDependency.findMany({
                where: { taskId: id },
                include: {
                    dependsOnTask: { select: { id: true, title: true, status: true } },
                },
            }),
            prisma.taskDependency.findMany({
                where: { dependsOnTaskId: id },
                include: {
                    task: { select: { id: true, title: true, status: true } },
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: { dependentOn, blockedBy },
        });
    } catch (error) {
        console.error("GET /api/tasks/[id]/dependencies error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// POST /api/tasks/[id]/dependencies - Add dependency
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { dependsOnTaskId } = body;

        if (!dependsOnTaskId) {
            return NextResponse.json({ success: false, error: "dependsOnTaskId requis" }, { status: 400 });
        }

        if (dependsOnTaskId === id) {
            return NextResponse.json({ success: false, error: "Une tâche ne peut pas dépendre d'elle-même" }, { status: 400 });
        }

        const dependency = await prisma.taskDependency.create({
            data: {
                taskId: id,
                dependsOnTaskId,
            },
            include: {
                dependsOnTask: { select: { id: true, title: true, status: true } },
            },
        });

        return NextResponse.json({ success: true, data: dependency });
    } catch (error: any) {
        if (error?.code === "P2002") {
            return NextResponse.json({ success: false, error: "Dépendance déjà existante" }, { status: 409 });
        }
        console.error("POST /api/tasks/[id]/dependencies error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// DELETE /api/tasks/[id]/dependencies
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const dependsOnTaskId = searchParams.get("dependsOnTaskId");

        if (!dependsOnTaskId) {
            return NextResponse.json({ success: false, error: "dependsOnTaskId requis" }, { status: 400 });
        }

        await prisma.taskDependency.deleteMany({
            where: { taskId: id, dependsOnTaskId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/tasks/[id]/dependencies error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
