// ============================================
// GET /api/client/contactable-managers
// Managers the client can contact via direct message (client portal: messaging only in mission or to a manager)
// ============================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SUPPORT_TEAM_NAME_MATCHERS = ["roeum", "hichem", "jeff", "sophie"];

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }
        if (session.user.role !== "CLIENT") {
            return NextResponse.json({ error: "Réservé aux clients" }, { status: 403 });
        }

        const managers = await prisma.user.findMany({
            where: {
                role: "MANAGER",
                isActive: true,
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: "asc" },
        });

        const supportTeamUsers = await prisma.user.findMany({
            where: {
                isActive: true,
                OR: SUPPORT_TEAM_NAME_MATCHERS.map((name) => ({
                    name: { contains: name, mode: "insensitive" },
                })),
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({
            managers: managers.map((m) => ({ id: m.id, name: m.name })),
            supportTeamUsers: supportTeamUsers.map((u) => ({ id: u.id, name: u.name })),
        });
    } catch (error) {
        console.error("Error fetching contactable managers:", error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération des managers" },
            { status: 500 }
        );
    }
}
