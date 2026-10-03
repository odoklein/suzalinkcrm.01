import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/tasks/[id]/time-entries
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;

        const entries = await prisma.taskTimeEntry.findMany({
            where: { taskId: id },
            include: {
                user: { select: { id: true, name: true } },
            },
            orderBy: { date: "desc" },
        });

        return NextResponse.json({ success: true, data: entries });
    } catch (error) {
        console.error("GET /api/tasks/[id]/time-entries error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// POST /api/tasks/[id]/time-entries - Log time
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { hours, description, date } = body;

        if (!hours || hours <= 0) {
            return NextResponse.json({ success: false, error: "Heures requises (> 0)" }, { status: 400 });
        }

        const task = await prisma.task.findUnique({
            where: { id },
            select: { id: true, projectId: true, loggedHours: true },
        });

        if (!task) {
            return NextResponse.json({ success: false, error: "Tâche non trouvée" }, { status: 404 });
        }

        const entry = await prisma.taskTimeEntry.create({
            data: {
                taskId: id,
                userId: session.user.id,
                hours: parseFloat(hours),
                description: description?.trim() || null,
                date: date ? new Date(date) : new Date(),
            },
            include: {
                user: { select: { id: true, name: true } },
            },
        });

        // Update total logged hours on task
        const totalLogged = await prisma.taskTimeEntry.aggregate({
            where: { taskId: id },
            _sum: { hours: true },
        });

        await prisma.task.update({
            where: { id },
            data: { loggedHours: totalLogged._sum.hours || 0 },
        });

        return NextResponse.json({ success: true, data: entry });
    } catch (error) {
        console.error("POST /api/tasks/[id]/time-entries error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
