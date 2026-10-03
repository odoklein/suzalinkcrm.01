import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/projects/[id]/members - Add member
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { userId, role } = body;

        if (!userId) {
            return NextResponse.json({ success: false, error: "userId requis" }, { status: 400 });
        }

        const project = await prisma.project.findUnique({
            where: { id },
            include: { members: true },
        });

        if (!project) {
            return NextResponse.json({ success: false, error: "Projet non trouvé" }, { status: 404 });
        }

        // Check permissions
        const isOwner = project.ownerId === session.user.id;
        const isAdmin = project.members.some(
            (m) => m.userId === session.user.id && ["owner", "admin"].includes(m.role)
        );
        const isManager = session.user.role === "MANAGER";
        const isSdr = session.user.role === "SDR";

        if (!isOwner && !isAdmin && !isManager && !isSdr) {
            return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
        }

        const member = await prisma.projectMember.create({
            data: {
                projectId: id,
                userId,
                role: role || "member",
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        // Log activity
        await prisma.projectActivity.create({
            data: {
                projectId: id,
                userId: session.user.id,
                action: "member_added",
                details: { addedUserId: userId, memberRole: role || "member" },
            },
        });

        return NextResponse.json({ success: true, data: member });
    } catch (error: any) {
        if (error?.code === "P2002") {
            return NextResponse.json({ success: false, error: "Membre déjà ajouté" }, { status: 409 });
        }
        console.error("POST /api/projects/[id]/members error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// DELETE /api/projects/[id]/members - Remove member
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ success: false, error: "userId requis" }, { status: 400 });
        }

        const project = await prisma.project.findUnique({
            where: { id },
            include: { members: true },
        });

        if (!project) {
            return NextResponse.json({ success: false, error: "Projet non trouvé" }, { status: 404 });
        }

        // Cannot remove owner
        if (project.ownerId === userId) {
            return NextResponse.json({ success: false, error: "Impossible de retirer le propriétaire" }, { status: 400 });
        }

        const isOwner = project.ownerId === session.user.id;
        const isAdmin = project.members.some(
            (m) => m.userId === session.user.id && ["owner", "admin"].includes(m.role)
        );
        const isManager = session.user.role === "MANAGER";
        const isSdr = session.user.role === "SDR";
        const isSelf = userId === session.user.id;

        if (!isOwner && !isAdmin && !isManager && !isSdr && !isSelf) {
            return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
        }

        await prisma.projectMember.deleteMany({
            where: { projectId: id, userId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/projects/[id]/members error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
