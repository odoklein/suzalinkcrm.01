import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/projects/[id] - Get project details with full stats
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;

        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                owner: { select: { id: true, name: true, email: true } },
                client: { select: { id: true, name: true } },
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true, role: true } },
                    },
                },
                tasks: {
                    include: {
                        assignee: { select: { id: true, name: true, email: true } },
                        createdBy: { select: { id: true, name: true } },
                        subtasks: { select: { id: true, status: true } },
                        _count: { select: { comments: true, subtasks: true, files: true } },
                    },
                    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
                },
                milestones: {
                    include: {
                        _count: { select: { tasks: true } },
                    },
                    orderBy: { position: "asc" },
                },
                activities: {
                    include: {
                        user: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 50,
                },
            },
        });

        if (!project) {
            return NextResponse.json({ success: false, error: "Projet non trouvé" }, { status: 404 });
        }

        // Check access
        const isMember = project.members.some((m) => m.userId === session.user.id);
        const isOwner = project.ownerId === session.user.id;
        const role = session.user.role;

        if (!isMember && !isOwner && role !== "MANAGER") {
            return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
        }

        // Build task stats
        const tasksByStatus = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
        const tasksByPriority = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
        const tasksByAssignee: Record<string, { name: string; count: number; completed: number }> = {};
        let overdueCount = 0;
        const now = new Date();

        project.tasks.forEach((t) => {
            tasksByStatus[t.status as keyof typeof tasksByStatus]++;
            tasksByPriority[t.priority as keyof typeof tasksByPriority]++;

            if (t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE") {
                overdueCount++;
            }

            if (t.assignee) {
                if (!tasksByAssignee[t.assignee.id]) {
                    tasksByAssignee[t.assignee.id] = { name: t.assignee.name, count: 0, completed: 0 };
                }
                tasksByAssignee[t.assignee.id].count++;
                if (t.status === "DONE") tasksByAssignee[t.assignee.id].completed++;
            }
        });

        const totalTasks = project.tasks.length;
        const completedTasks = tasksByStatus.DONE;
        const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return NextResponse.json({
            success: true,
            data: {
                ...project,
                taskStats: {
                    byStatus: tasksByStatus,
                    byPriority: tasksByPriority,
                    byAssignee: Object.values(tasksByAssignee),
                    total: totalTasks,
                    completed: completedTasks,
                    overdue: overdueCount,
                    completionPercent,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/projects/[id] error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { name, description, status, clientId, startDate, endDate, color, icon } = body;

        const project = await prisma.project.findUnique({
            where: { id },
            include: { members: true },
        });

        if (!project) {
            return NextResponse.json({ success: false, error: "Projet non trouvé" }, { status: 404 });
        }

        const isOwner = project.ownerId === session.user.id;
        const isAdmin = project.members.some((m) => m.userId === session.user.id && m.role === "admin");
        const isManager = session.user.role === "MANAGER";
        const isSdr = session.user.role === "SDR";

        if (!isOwner && !isAdmin && !isManager && !isSdr) {
            return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
        }

        const updateData: any = {};
        if (name) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (status) updateData.status = status;
        if (clientId !== undefined) updateData.clientId = clientId || null;
        if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
        if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
        if (color !== undefined) updateData.color = color;
        if (icon !== undefined) updateData.icon = icon;

        // Handle archive
        if (status === "ARCHIVED" && !project.archivedAt) {
            updateData.archivedAt = new Date();
        } else if (status && status !== "ARCHIVED" && project.archivedAt) {
            updateData.archivedAt = null;
        }

        const updated = await prisma.project.update({
            where: { id },
            data: updateData,
            include: {
                owner: { select: { id: true, name: true, email: true } },
                client: { select: { id: true, name: true } },
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });

        // Log activity
        const changes: string[] = [];
        if (name && name !== project.name) changes.push("name");
        if (status && status !== project.status) changes.push("status");
        if (changes.length > 0) {
            await prisma.projectActivity.create({
                data: {
                    projectId: id,
                    userId: session.user.id,
                    action: "project_updated",
                    details: {
                        changes,
                        ...(status && status !== project.status && { statusFrom: project.status, statusTo: status }),
                    },
                },
            });
        }

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error("PATCH /api/projects/[id] error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;

        const project = await prisma.project.findUnique({ where: { id } });

        if (!project) {
            return NextResponse.json({ success: false, error: "Projet non trouvé" }, { status: 404 });
        }

        if (project.ownerId !== session.user.id && session.user.role !== "MANAGER" && session.user.role !== "SDR") {
            return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
        }

        await prisma.project.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/projects/[id] error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
