import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/projects/[id]/duplicate - Duplicate project with tasks
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        if (!["MANAGER", "DEVELOPER", "SDR"].includes(session.user.role || "")) {
            return NextResponse.json({ success: false, error: "Rôle non autorisé" }, { status: 403 });
        }

        const { id } = await params;

        const source = await prisma.project.findUnique({
            where: { id },
            include: {
                members: true,
                tasks: {
                    where: { parentTaskId: null },
                    include: {
                        subtasks: true,
                    },
                    orderBy: { position: "asc" },
                },
                milestones: { orderBy: { position: "asc" } },
            },
        });

        if (!source) {
            return NextResponse.json({ success: false, error: "Projet non trouvé" }, { status: 404 });
        }

        // Create duplicated project
        const duplicated = await prisma.project.create({
            data: {
                name: `${source.name} (copie)`,
                description: source.description,
                status: "ACTIVE",
                ownerId: session.user.id,
                clientId: source.clientId,
                color: source.color,
                icon: source.icon,
                members: {
                    create: [
                        { userId: session.user.id, role: "owner" },
                    ],
                },
            },
        });

        // Duplicate milestones and map old IDs to new
        const milestoneMap: Record<string, string> = {};
        for (const ms of source.milestones) {
            const newMs = await prisma.projectMilestone.create({
                data: {
                    projectId: duplicated.id,
                    title: ms.title,
                    description: ms.description,
                    dueDate: ms.dueDate,
                    position: ms.position,
                },
            });
            milestoneMap[ms.id] = newMs.id;
        }

        // Duplicate tasks
        for (const task of source.tasks) {
            const newTask = await prisma.task.create({
                data: {
                    projectId: duplicated.id,
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    position: task.position,
                    labels: task.labels,
                    estimatedHours: task.estimatedHours,
                    milestoneId: task.milestoneId ? milestoneMap[task.milestoneId] || null : null,
                    createdById: session.user.id,
                },
            });

            // Duplicate subtasks
            for (const sub of task.subtasks) {
                await prisma.task.create({
                    data: {
                        projectId: duplicated.id,
                        parentTaskId: newTask.id,
                        title: sub.title,
                        description: sub.description,
                        priority: sub.priority,
                        position: sub.position,
                        labels: sub.labels,
                        createdById: session.user.id,
                    },
                });
            }
        }

        // Log activity
        await prisma.projectActivity.create({
            data: {
                projectId: duplicated.id,
                userId: session.user.id,
                action: "project_duplicated",
                details: { sourceProjectId: id, sourceProjectName: source.name },
            },
        });

        return NextResponse.json({ success: true, data: duplicated });
    } catch (error) {
        console.error("POST /api/projects/[id]/duplicate error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
