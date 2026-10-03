import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/projects/templates - List templates
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const templates = await prisma.projectTemplate.findMany({
            include: {
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ success: true, data: templates });
    } catch (error) {
        console.error("GET /api/projects/templates error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// POST /api/projects/templates - Create template
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        if (!["MANAGER", "DEVELOPER"].includes(session.user.role || "")) {
            return NextResponse.json({ success: false, error: "Rôle non autorisé" }, { status: 403 });
        }

        const body = await req.json();
        const { name, description, structure, projectId } = body;

        if (!name?.trim()) {
            return NextResponse.json({ success: false, error: "Nom requis" }, { status: 400 });
        }

        // If creating from existing project, build structure
        let templateStructure = structure;
        if (projectId && !structure) {
            const tasks = await prisma.task.findMany({
                where: { projectId, parentTaskId: null },
                include: {
                    subtasks: { select: { title: true, description: true, priority: true } },
                },
                orderBy: { position: "asc" },
            });

            templateStructure = {
                tasks: tasks.map((t) => ({
                    title: t.title,
                    description: t.description,
                    priority: t.priority,
                    subtasks: t.subtasks.map((s) => ({
                        title: s.title,
                        description: s.description,
                        priority: s.priority,
                    })),
                })),
            };
        }

        const template = await prisma.projectTemplate.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                structure: templateStructure || { tasks: [] },
                createdById: session.user.id,
            },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ success: true, data: template });
    } catch (error) {
        console.error("POST /api/projects/templates error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
