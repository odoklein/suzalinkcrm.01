import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/projects/[id]/milestones
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;

        const milestones = await prisma.projectMilestone.findMany({
            where: { projectId: id },
            include: {
                tasks: {
                    select: { id: true, title: true, status: true },
                },
                _count: { select: { tasks: true } },
            },
            orderBy: { position: "asc" },
        });

        return NextResponse.json({ success: true, data: milestones });
    } catch (error) {
        console.error("GET /api/projects/[id]/milestones error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// POST /api/projects/[id]/milestones
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { title, description, dueDate } = body;

        if (!title?.trim()) {
            return NextResponse.json({ success: false, error: "Titre requis" }, { status: 400 });
        }

        const lastMilestone = await prisma.projectMilestone.findFirst({
            where: { projectId: id },
            orderBy: { position: "desc" },
            select: { position: true },
        });

        const milestone = await prisma.projectMilestone.create({
            data: {
                projectId: id,
                title: title.trim(),
                description: description?.trim() || null,
                dueDate: dueDate ? new Date(dueDate) : null,
                position: (lastMilestone?.position ?? -1) + 1,
            },
            include: {
                _count: { select: { tasks: true } },
            },
        });

        await prisma.projectActivity.create({
            data: {
                projectId: id,
                userId: session.user.id,
                action: "milestone_created",
                details: { title: milestone.title },
            },
        });

        return NextResponse.json({ success: true, data: milestone });
    } catch (error) {
        console.error("POST /api/projects/[id]/milestones error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// PATCH /api/projects/[id]/milestones
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const body = await req.json();
        const { milestoneId, title, description, dueDate, completedAt } = body;

        if (!milestoneId) {
            return NextResponse.json({ success: false, error: "milestoneId requis" }, { status: 400 });
        }

        const updateData: any = {};
        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
        if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null;

        const milestone = await prisma.projectMilestone.update({
            where: { id: milestoneId },
            data: updateData,
        });

        return NextResponse.json({ success: true, data: milestone });
    } catch (error) {
        console.error("PATCH /api/projects/[id]/milestones error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
